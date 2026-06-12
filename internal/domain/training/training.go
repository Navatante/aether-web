// Package training reimplementa sp_get_adiestramiento + sp_get_instruccion.
// Cada endpoint hace 3 queries (papeletas, personas, papeletas_realizadas)
// y compone el JSON final en Go. crp_medio y airflow_medio se calculan en Go
// como AVG sobre los valores per-persona.
package training

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== Defaults (espejo del SP) =====

var (
	defaultRolesPiloto = []string{"Piloto"}
	defaultBloques     = []string{"Práctico Piloto", "Simulador", "Vuelo"}
	defaultPlanes      = []string{"Instrucción 1 Piloto", "Instrucción 2 Piloto"}
)

// ===== DTOs =====

// PapeletaItem es el shape común para papeletas en adiestramiento e instrucción.
type PapeletaItem struct {
	PapeletaSk            int32   `json:"papeleta_sk"`
	PapeletaName          string  `json:"papeleta_name"`
	PapeletaDescription   string  `json:"papeleta_description"`
	PapeletaBlock         string  `json:"papeleta_block"`
	PapeletaPlan          *string `json:"papeleta_plan"`
	PapeletaPilotCrpValue *int32  `json:"papeleta_pilot_crp_value"`
	PapeletaDvCrpValue    *int32  `json:"papeleta_dv_crp_value"`
	PapeletaExpiration    *int32  `json:"papeleta_expiration"`
}

type AdiestramientoResult struct {
	Papeletas    []PapeletaItem        `json:"papeletas"`
	CrpMedio     float64               `json:"crp_medio"`
	AirflowMedio float64               `json:"airflow_medio"`
	Personas     []AdiestramientoPersona `json:"personas"`
}

type AdiestramientoPersona struct {
	PersonSk            int32                       `json:"person_sk"`
	PersonNk            *string                     `json:"person_nk"`
	OrderPosition       int64                       `json:"order_position"`
	FullName            string                      `json:"full_name"`
	Crp                 int32                       `json:"crp"`
	DiasSinVolar        int32                       `json:"dias_sin_volar"`
	DiasSinVueloReal    int32                       `json:"dias_sin_vuelo_real"`
	DiasSinSimulador    int32                       `json:"dias_sin_simulador"`
	PapeletasRealizadas []AdiestramientoPapeleta    `json:"papeletas_realizadas"`
}

type AdiestramientoPapeleta struct {
	SessionFk         int32  `json:"session_fk"`
	DiasTranscurridos int32  `json:"dias_transcurridos"`
	DiasRestantes     int32  `json:"dias_restantes"`
	Estado            string `json:"estado"`
}

type InstruccionResult struct {
	Papeletas []PapeletaItem      `json:"papeletas"`
	Personas  []InstruccionPersona `json:"personas"`
}

type InstruccionPersona struct {
	PersonSk            int32                  `json:"person_sk"`
	PersonNk            *string                `json:"person_nk"`
	FullName            string                 `json:"full_name"`
	OrderPosition       int64                  `json:"order_position"`
	PapeletasRealizadas []InstruccionPapeleta  `json:"papeletas_realizadas"`
}

type InstruccionPapeleta struct {
	SessionFk  int32  `json:"session_fk"`
	FlightDate string `json:"flight_date"` // YYYY-MM-DD
}

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

func (s *Service) Adiestramiento(ctx context.Context, esc int32, roles, bloques []string) (AdiestramientoResult, error) {
	if len(roles) == 0 {
		roles = defaultRolesPiloto
	}
	if len(bloques) == 0 {
		bloques = defaultBloques
	}

	papRows, err := s.q.AdiestramientoPapeletas(ctx, queries.AdiestramientoPapeletasParams{
		Column1:               bloques,
		PapeletaEscuadrillaFk: esc,
	})
	if err != nil {
		return AdiestramientoResult{}, err
	}
	personRows, err := s.q.AdiestramientoPersonas(ctx, queries.AdiestramientoPersonasParams{
		Column1:             roles,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return AdiestramientoResult{}, err
	}
	realizadasRows, err := s.q.AdiestramientoPapeletasRealizadas(ctx, queries.AdiestramientoPapeletasRealizadasParams{
		Column1:             roles,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return AdiestramientoResult{}, err
	}

	// Map papeletas realizadas por person_sk.
	porPersona := make(map[int32][]AdiestramientoPapeleta)
	for _, r := range realizadasRows {
		porPersona[r.PersonSk] = append(porPersona[r.PersonSk], AdiestramientoPapeleta{
			SessionFk:         r.SessionFk,
			DiasTranscurridos: r.DiasTranscurridos,
			DiasRestantes:     r.DiasRestantes,
			Estado:            r.Estado,
		})
	}

	// Build personas + acumular para averages.
	personas := make([]AdiestramientoPersona, 0, len(personRows))
	var crpSum, airflowSum float64
	for _, p := range personRows {
		// papeletas_realizadas nil → [] para que JSON sea consistente con el SP original.
		rls := porPersona[p.PersonSk]
		if rls == nil {
			rls = []AdiestramientoPapeleta{}
		}
		personas = append(personas, AdiestramientoPersona{
			PersonSk:            p.PersonSk,
			PersonNk:            p.PersonNk,
			OrderPosition:       p.OrderPosition,
			FullName:            p.FullName,
			Crp:                 p.Crp,
			DiasSinVolar:        p.DiasSinVolar,
			DiasSinVueloReal:    p.DiasSinVueloReal,
			DiasSinSimulador:    p.DiasSinSimulador,
			PapeletasRealizadas: rls,
		})
		crpSum += float64(p.Crp)
		airflowSum += airflowFromDias(p.DiasSinVolar)
	}

	n := float64(len(personRows))
	crpMedio, airflowMedio := 0.0, 0.0
	if n > 0 {
		crpMedio = roundTo2(crpSum / n)
		airflowMedio = roundTo2(airflowSum / n)
	}

	papeletas := make([]PapeletaItem, 0, len(papRows))
	for _, r := range papRows {
		papeletas = append(papeletas, PapeletaItem{
			PapeletaSk: r.PapeletaSk, PapeletaName: r.PapeletaName,
			PapeletaDescription: r.PapeletaDescription, PapeletaBlock: r.PapeletaBlock,
			PapeletaPlan: r.PapeletaPlan, PapeletaPilotCrpValue: r.PapeletaPilotCrpValue,
			PapeletaDvCrpValue: r.PapeletaDvCrpValue, PapeletaExpiration: r.PapeletaExpiration,
		})
	}

	return AdiestramientoResult{
		Papeletas: papeletas, CrpMedio: crpMedio, AirflowMedio: airflowMedio, Personas: personas,
	}, nil
}

func (s *Service) Instruccion(ctx context.Context, esc int32, roles, planes []string) (InstruccionResult, error) {
	if len(roles) == 0 {
		roles = defaultRolesPiloto
	}
	if len(planes) == 0 {
		planes = defaultPlanes
	}

	papRows, err := s.q.InstruccionPapeletas(ctx, queries.InstruccionPapeletasParams{
		Column1:               planes,
		PapeletaEscuadrillaFk: esc,
	})
	if err != nil {
		return InstruccionResult{}, err
	}
	personRows, err := s.q.InstruccionPersonas(ctx, queries.InstruccionPersonasParams{
		Column1:             roles,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return InstruccionResult{}, err
	}
	realizadasRows, err := s.q.InstruccionPapeletasRealizadas(ctx, queries.InstruccionPapeletasRealizadasParams{
		Column1:             planes,
		Column2:             roles,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return InstruccionResult{}, err
	}

	porPersona := make(map[int32][]InstruccionPapeleta)
	for _, r := range realizadasRows {
		porPersona[r.PersonSk] = append(porPersona[r.PersonSk], InstruccionPapeleta{
			SessionFk:  r.SessionFk,
			FlightDate: r.FlightDate.Time.Format("2006-01-02"),
		})
	}

	personas := make([]InstruccionPersona, 0, len(personRows))
	for _, p := range personRows {
		rls := porPersona[p.PersonSk]
		if rls == nil {
			rls = []InstruccionPapeleta{}
		}
		personas = append(personas, InstruccionPersona{
			PersonSk:            p.PersonSk,
			PersonNk:            p.PersonNk,
			FullName:            p.FullName,
			OrderPosition:       p.OrderPosition,
			PapeletasRealizadas: rls,
		})
	}

	papeletas := make([]PapeletaItem, 0, len(papRows))
	for _, r := range papRows {
		papeletas = append(papeletas, PapeletaItem{
			PapeletaSk: r.PapeletaSk, PapeletaName: r.PapeletaName,
			PapeletaDescription: r.PapeletaDescription, PapeletaBlock: r.PapeletaBlock,
			PapeletaPlan: r.PapeletaPlan, PapeletaPilotCrpValue: r.PapeletaPilotCrpValue,
			PapeletaDvCrpValue: r.PapeletaDvCrpValue, PapeletaExpiration: r.PapeletaExpiration,
		})
	}

	return InstruccionResult{Papeletas: papeletas, Personas: personas}, nil
}

// airflowFromDias replica la fórmula del SP: airflow=0 si nunca voló (-1)
// o si dias>=60, lineal decreciente entre 0 y 60.
func airflowFromDias(dias int32) float64 {
	if dias < 0 {
		return 0
	}
	if dias >= 60 {
		return 0
	}
	return 100.0 - (float64(dias)/60.0)*100.0
}

func roundTo2(x float64) float64 {
	return math.Round(x*100) / 100
}

// ===== Handlers =====

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	g.GET("/training/adiestramiento", h.Adiestramiento, mw)
	g.GET("/training/instruccion", h.Instruccion, mw)
}

func (h *Handlers) Adiestramiento(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	roles := splitCSV(c.QueryParam("roles"))
	bloques := splitCSV(c.QueryParam("bloques"))
	res, err := h.svc.Adiestramiento(c.Request().Context(), int32(user.EscuadrillaID), roles, bloques)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) Instruccion(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	roles := splitCSV(c.QueryParam("roles"))
	planes := splitCSV(c.QueryParam("planes"))
	res, err := h.svc.Instruccion(c.Request().Context(), int32(user.EscuadrillaID), roles, planes)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

// Helpers que ya no necesitan errors (los traemos para futuras extensiones).
var _ = errors.New

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
