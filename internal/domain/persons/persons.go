// Package persons implementa el CRUD de detall.person.
//
// Fixes vs. el original Rust:
//   - add_person: papeleta_escuadrilla_fk = $X explícito (Rust dependía de SESSION_CONTEXT).
//   - permission_level por defecto = 'Común' con acento (Rust ponía 'Comun', que falla CHK).
//   - update_person: WHERE incluye person_escuadrilla_fk = $X (impide editar de otra escuadrilla).
//   - dardebaja/dardealta: SetPersonCurrentFlag con WHERE escuadrilla_fk.
package persons

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/queries"
)

// ===== DTOs =====

// PersonItem espeja el shape de sp_get_persons (Spanish aliases camelCase).
// El frontend ya lo consume así desde transformPersonnelFromDB.ts.
type PersonItem struct {
	ID               int32   `json:"id"`
	Nk               *string `json:"nk"`
	Usuario          string  `json:"usuario"`
	Empleo           string  `json:"empleo"`
	Cuerpo           string  `json:"cuerpo"`
	Especialidad     string  `json:"especialidad"`
	Nombre           string  `json:"nombre"`
	Apellido1        string  `json:"apellido1"`
	Apellido2        string  `json:"apellido2"`
	NombreCompleto   string  `json:"nombreCompleto"`
	Telefono         string  `json:"telefono"`
	Dni              *string `json:"dni"`
	Localidad        string  `json:"localidad"`
	Division         string  `json:"division"`
	Rol              string  `json:"rol"`
	AntiguedadEmpleo string  `json:"antiguedadEmpleo"` // YYYY-MM-DD
	FechaEmbarco     string  `json:"fechaEmbarco"`
	FechaNacimiento  string  `json:"fechaNacimiento"`
	NumeroEscalafon  int32   `json:"numeroEscalafon"`
	Activo           bool    `json:"activo"`
	OrdenPosicion    int64   `json:"ordenPosicion"`
}

type ListResult struct {
	Items      []PersonItem `json:"items"`
	TotalCount int32        `json:"total_count"`
}

// WriteReq espeja CreatePersonDto del Rust original.
// Bug fix vs Rust: añadimos person_localidad (NOT NULL en BD; el DTO Rust
// la omitía, lo que hacía que cualquier add_person fallara contra el esquema).
type WriteReq struct {
	PersonNk           *string `json:"person_nk"`
	PersonUser         string  `json:"person_user"`
	PersonRank         string  `json:"person_rank"`
	PersonCuerpo       string  `json:"person_cuerpo"`
	PersonEspecialidad string  `json:"person_especialidad"`
	PersonName         string  `json:"person_name"`
	PersonLastName1    string  `json:"person_last_name_1"`
	PersonLastName2    string  `json:"person_last_name_2"`
	PersonPhone        string  `json:"person_phone"`
	PersonDni          *string `json:"person_dni"`
	PersonLocalidad    string  `json:"person_localidad"`
	PersonDivision     string  `json:"person_division"`
	PersonRol          string  `json:"person_rol"`
	PersonAEmp         string  `json:"person_a_emp"`     // YYYY-MM-DD
	PersonFEmb         string  `json:"person_f_emb"`     // YYYY-MM-DD
	PersonBirthdate    string  `json:"person_birthdate"` // YYYY-MM-DD
	PersonNumEscalafon int32   `json:"person_num_escalafon"`
}

type PersonSkNk struct {
	PersonSk int32  `json:"person_sk"`
	PersonNk string `json:"person_nk"`
}

// ===== Superusuario (god-mode) DTOs =====

// SuperuserPersonItem es una persona de la escuadrilla del superusuario, para
// su panel (gestión de credenciales y permisos, acotada a la escuadrilla).
type SuperuserPersonItem struct {
	ID              int32  `json:"id"`
	NombreCompleto  string `json:"nombreCompleto"`
	Usuario         string `json:"usuario"`
	PermissionLevel string `json:"permissionLevel"`
	TienePassword   bool   `json:"tienePassword"`
}

type SetPermissionLevelReq struct {
	PermissionLevel string `json:"permissionLevel"`
}

// ===== Sentinel errors =====

var (
	ErrNotFound      = errors.New("persons: not found or no state change")
	ErrDuplicate     = errors.New("persons: duplicate person_user, person_nk or person_dni")
	ErrInvalidInput  = errors.New("persons: invalid input")
	ErrInvalidLevel  = errors.New("persons: nivel de permiso inválido")
	ErrLastSuperuser = errors.New("persons: no se puede quitar el último Superusuario")
)

// validPermissionLevels es la allow-list de niveles asignables (espejo del
// CHECK chk_person_permission_level).
var validPermissionLevels = map[string]struct{}{
	auth.PermComun:          {},
	auth.PermOperacional:    {},
	auth.PermAdministrativo: {},
	auth.PermSeguridad:      {},
	auth.PermSuperusuario:   {},
}

// ===== Service =====

type Service struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool, q: queries.New(pool)} }

// setAuditGUCs fija aether.user_id/aether.ip_address LOCAL en la transacción
// para que el trigger tr_audit_person registre quién hizo el cambio (mismo
// patrón que flights.setAuditGUCs / tr_audit_flight).
func setAuditGUCs(ctx context.Context, tx pgx.Tx, userID, ip string) error {
	if _, err := tx.Exec(ctx, "SELECT set_config('aether.user_id', $1, true)", userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "SELECT set_config('aether.ip_address', $1, true)", ip); err != nil {
		return err
	}
	return nil
}

// withAudit ejecuta fn dentro de una transacción con las GUCs de auditoría
// fijadas, de modo que tr_audit_person capture el actor. Las lecturas previas
// (p. ej. anti-lockout) pueden quedar fuera; aquí solo va la escritura auditada.
func (s *Service) withAudit(ctx context.Context, userID, ip string, fn func(q *queries.Queries) error) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := setAuditGUCs(ctx, tx, userID, ip); err != nil {
		return err
	}
	if err := fn(queries.New(tx)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) List(ctx context.Context, esc int32) (ListResult, error) {
	rows, err := s.q.ListPersons(ctx, esc)
	if err != nil {
		return ListResult{}, err
	}
	total, err := s.q.CountPersons(ctx, esc)
	if err != nil {
		return ListResult{}, err
	}
	out := make([]PersonItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, PersonItem{
			ID:               r.ID,
			Nk:               r.Nk,
			Usuario:          r.Usuario,
			Empleo:           r.Empleo,
			Cuerpo:           r.Cuerpo,
			Especialidad:     r.Especialidad,
			Nombre:           r.Nombre,
			Apellido1:        r.Apellido1,
			Apellido2:        r.Apellido2,
			NombreCompleto:   r.NombreCompleto,
			Telefono:         r.Telefono,
			Dni:              r.Dni,
			Localidad:        r.Localidad,
			Division:         r.Division,
			Rol:              r.Rol,
			AntiguedadEmpleo: formatDate(r.AntiguedadEmpleo),
			FechaEmbarco:     formatDate(r.FechaEmbarco),
			FechaNacimiento:  formatDate(r.FechaNacimiento),
			NumeroEscalafon:  r.NumeroEscalafon,
			Activo:           r.Activo,
			OrdenPosicion:    r.OrdenPosicion,
		})
	}
	return ListResult{Items: out, TotalCount: total}, nil
}

func (s *Service) Create(ctx context.Context, esc int32, userID, ip string, req WriteReq) (int32, error) {
	if req.PersonUser == "" || req.PersonRank == "" || req.PersonName == "" {
		return 0, ErrInvalidInput
	}
	aEmp, err := parseDate(req.PersonAEmp)
	if err != nil {
		return 0, ErrInvalidInput
	}
	fEmb, err := parseDate(req.PersonFEmb)
	if err != nil {
		return 0, ErrInvalidInput
	}
	birth, err := parseDate(req.PersonBirthdate)
	if err != nil {
		return 0, ErrInvalidInput
	}
	// El alta deja la contraseña por defecto ('aether') hasheada; el INSERT
	// marca person_password_must_change = TRUE, así la persona puede entrar de
	// inmediato pero se le fuerza el cambio en el primer login.
	defaultHash, err := auth.HashPassword(auth.DefaultPassword)
	if err != nil {
		return 0, err
	}
	var id int32
	err = s.withAudit(ctx, userID, ip, func(q *queries.Queries) error {
		var e error
		id, e = q.InsertPerson(ctx, queries.InsertPersonParams{
			PersonNk:            req.PersonNk,
			PersonUser:          req.PersonUser,
			PersonRank:          req.PersonRank,
			PersonCuerpo:        req.PersonCuerpo,
			PersonEspecialidad:  req.PersonEspecialidad,
			PersonName:          req.PersonName,
			PersonLastName1:     req.PersonLastName1,
			PersonLastName2:     req.PersonLastName2,
			PersonPhone:         req.PersonPhone,
			PersonDni:           req.PersonDni,
			PersonLocalidad:     req.PersonLocalidad,
			PersonDivision:      req.PersonDivision,
			PersonRol:           req.PersonRol,
			PersonAEmp:          aEmp,
			PersonFEmb:          fEmb,
			PersonBirthdate:     birth,
			PersonNumEscalafon:  req.PersonNumEscalafon,
			PersonEscuadrillaFk: esc,
			PersonPasswordHash:  &defaultHash,
		})
		return e
	})
	if isUniqueViolation(err) {
		return 0, ErrDuplicate
	}
	return id, err
}

func (s *Service) Update(ctx context.Context, esc int32, id int32, userID, ip string, req WriteReq) error {
	if req.PersonUser == "" || req.PersonRank == "" || req.PersonName == "" {
		return ErrInvalidInput
	}
	aEmp, err := parseDate(req.PersonAEmp)
	if err != nil {
		return ErrInvalidInput
	}
	fEmb, err := parseDate(req.PersonFEmb)
	if err != nil {
		return ErrInvalidInput
	}
	birth, err := parseDate(req.PersonBirthdate)
	if err != nil {
		return ErrInvalidInput
	}
	var n int64
	err = s.withAudit(ctx, userID, ip, func(q *queries.Queries) error {
		var e error
		n, e = q.UpdatePerson(ctx, queries.UpdatePersonParams{
			PersonNk:            req.PersonNk,
			PersonUser:          req.PersonUser,
			PersonRank:          req.PersonRank,
			PersonCuerpo:        req.PersonCuerpo,
			PersonEspecialidad:  req.PersonEspecialidad,
			PersonName:          req.PersonName,
			PersonLastName1:     req.PersonLastName1,
			PersonLastName2:     req.PersonLastName2,
			PersonPhone:         req.PersonPhone,
			PersonDni:           req.PersonDni,
			PersonLocalidad:     req.PersonLocalidad,
			PersonDivision:      req.PersonDivision,
			PersonRol:           req.PersonRol,
			PersonAEmp:          aEmp,
			PersonFEmb:          fEmb,
			PersonBirthdate:     birth,
			PersonNumEscalafon:  req.PersonNumEscalafon,
			PersonSk:            id,
			PersonEscuadrillaFk: esc,
		})
		return e
	})
	if isUniqueViolation(err) {
		return ErrDuplicate
	}
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// SetCurrentFlag implementa dardealta/dardebaja. desiredActive=true → alta, false → baja.
func (s *Service) SetCurrentFlag(ctx context.Context, esc int32, id int32, userID, ip string, desiredActive bool) error {
	var n int64
	err := s.withAudit(ctx, userID, ip, func(q *queries.Queries) error {
		var e error
		n, e = q.SetPersonCurrentFlag(ctx, queries.SetPersonCurrentFlagParams{
			PersonCurrentFlag:   desiredActive,
			PersonSk:            id,
			PersonEscuadrillaFk: esc,
		})
		return e
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) BySks(ctx context.Context, esc int32, sks []int32) ([]PersonSkNk, error) {
	if len(sks) == 0 {
		return []PersonSkNk{}, nil
	}
	rows, err := s.q.GetCrewMembersBySk(ctx, queries.GetCrewMembersBySkParams{
		Column1:             sks,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		return nil, err
	}
	out := make([]PersonSkNk, 0, len(rows))
	for _, r := range rows {
		nk := ""
		if r.PersonNk != nil {
			nk = *r.PersonNk
		}
		out = append(out, PersonSkNk{PersonSk: r.PersonSk, PersonNk: nk})
	}
	return out, nil
}

// ===== Superusuario (god-mode acotado a la escuadrilla) =====
//
// El superusuario gestiona credenciales y niveles de permiso, pero SOLO de
// personas de su propia escuadrilla. Igual que el resto del dominio, estas
// operaciones filtran por person_escuadrilla_fk (el esc de la sesión): una
// persona de otra escuadrilla simplemente no existe para estas queries.

func (s *Service) ListForSuperuser(ctx context.Context, esc int32) ([]SuperuserPersonItem, error) {
	rows, err := s.q.ListPersonsForSuperuser(ctx, esc)
	if err != nil {
		return nil, err
	}
	out := make([]SuperuserPersonItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, SuperuserPersonItem{
			ID:              r.ID,
			NombreCompleto:  r.NombreCompleto,
			Usuario:         r.Usuario,
			PermissionLevel: r.Nivel,
			TienePassword:   r.TienePassword,
		})
	}
	return out, nil
}

// ResetPasswordToDefault deja la contraseña de la persona en el valor por
// defecto ('aether') y fuerza el cambio en el siguiente login (la query pone
// person_password_must_change = TRUE). No recibe la contraseña del cliente: el
// Superusuario nunca maneja contraseñas en claro. Acotado a su escuadrilla.
func (s *Service) ResetPasswordToDefault(ctx context.Context, esc, id int32, userID, ip string) error {
	hash, err := auth.HashPassword(auth.DefaultPassword)
	if err != nil {
		return err
	}
	var n int64
	err = s.withAudit(ctx, userID, ip, func(q *queries.Queries) error {
		var e error
		n, e = q.SetPersonPasswordBySk(ctx, queries.SetPersonPasswordBySkParams{
			PersonPasswordHash:  &hash,
			PersonSk:            id,
			PersonEscuadrillaFk: esc,
		})
		return e
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) SetPermissionLevel(ctx context.Context, esc, id int32, userID, ip, level string) error {
	if _, ok := validPermissionLevels[level]; !ok {
		return ErrInvalidLevel
	}
	current, err := s.q.GetPersonPermissionLevelInEscuadrilla(ctx, queries.GetPersonPermissionLevelInEscuadrillaParams{
		PersonSk:            id,
		PersonEscuadrillaFk: esc,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	// Anti-lockout: no degradar al último Superusuario que queda en la escuadrilla.
	if current == auth.PermSuperusuario && level != auth.PermSuperusuario {
		count, err := s.q.CountSuperusersInEscuadrilla(ctx, esc)
		if err != nil {
			return err
		}
		if count <= 1 {
			return ErrLastSuperuser
		}
	}
	var n int64
	err = s.withAudit(ctx, userID, ip, func(q *queries.Queries) error {
		var e error
		n, e = q.SetPersonPermissionLevel(ctx, queries.SetPersonPermissionLevelParams{
			PersonPermissionLevel: level,
			PersonSk:              id,
			PersonEscuadrillaFk:   esc,
		})
		return e
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ===== Handlers =====

type Handlers struct{ svc *Service }

func NewHandlers(svc *Service) *Handlers { return &Handlers{svc: svc} }

func (h *Handlers) Register(g *echo.Group, authSvc *auth.Service) {
	mw := auth.RequireAuth(authSvc)
	administrativo := auth.RequirePermission(auth.PermAdministrativo)
	g.GET("/persons", h.List, mw)
	g.POST("/persons", h.Create, mw, administrativo)
	g.PUT("/persons/:id", h.Update, mw, administrativo)
	g.POST("/persons/:id/deactivate", h.Deactivate, mw, administrativo)
	g.POST("/persons/:id/activate", h.Activate, mw, administrativo)
	g.GET("/persons/by-sks", h.BySks, mw)

	// Panel de superusuario (god-mode): gestión global de credenciales y
	// permisos, fuera de la RLS por escuadrilla.
	superusuario := auth.RequirePermission(auth.PermSuperusuario)
	g.GET("/superuser/persons", h.SuperuserList, mw, superusuario)
	g.PUT("/superuser/persons/:id/password", h.SuperuserSetPassword, mw, superusuario)
	g.PATCH("/superuser/persons/:id/permission-level", h.SuperuserSetPermissionLevel, mw, superusuario)
}

func (h *Handlers) List(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.List(c.Request().Context(), int32(user.EscuadrillaID))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) Create(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	var req WriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	id, err := h.svc.Create(c.Request().Context(), int32(user.EscuadrillaID), user.Username, c.RealIP(), req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case err != nil:
		return err
	}
	return c.JSON(http.StatusCreated, map[string]int32{"id": id})
}

func (h *Handlers) Update(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseID(c, "id")
	if herr != nil {
		return herr
	}
	var req WriteReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.Update(c.Request().Context(), int32(user.EscuadrillaID), id, user.Username, c.RealIP(), req)
	switch {
	case errors.Is(err, ErrInvalidInput):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrDuplicate):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) Deactivate(c echo.Context) error { return h.setFlag(c, false) }
func (h *Handlers) Activate(c echo.Context) error   { return h.setFlag(c, true) }

func (h *Handlers) setFlag(c echo.Context, active bool) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseID(c, "id")
	if herr != nil {
		return herr
	}
	err := h.svc.SetCurrentFlag(c.Request().Context(), int32(user.EscuadrillaID), id, user.Username, c.RealIP(), active)
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) BySks(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	raw := c.QueryParam("sks")
	if raw == "" {
		return c.JSON(http.StatusOK, []PersonSkNk{})
	}
	parts := strings.Split(raw, ",")
	sks := make([]int32, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.ParseInt(strings.TrimSpace(p), 10, 32)
		if err != nil || n <= 0 {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid sk in list: "+p)
		}
		sks = append(sks, int32(n))
	}
	res, err := h.svc.BySks(c.Request().Context(), int32(user.EscuadrillaID), sks)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

// ===== Superusuario handlers =====

func (h *Handlers) SuperuserList(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	res, err := h.svc.ListForSuperuser(c.Request().Context(), int32(user.EscuadrillaID))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handlers) SuperuserSetPassword(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseID(c, "id")
	if herr != nil {
		return herr
	}
	// Acción de reseteo: deja la contraseña en el valor por defecto y fuerza el
	// cambio. No se acepta contraseña del cliente.
	err := h.svc.ResetPasswordToDefault(c.Request().Context(), int32(user.EscuadrillaID), id, user.Username, c.RealIP())
	switch {
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handlers) SuperuserSetPermissionLevel(c echo.Context) error {
	user := auth.CurrentUser(c)
	if user == nil {
		return echo.NewHTTPError(http.StatusUnauthorized)
	}
	id, herr := parseID(c, "id")
	if herr != nil {
		return herr
	}
	var req SetPermissionLevelReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid body")
	}
	err := h.svc.SetPermissionLevel(c.Request().Context(), int32(user.EscuadrillaID), id, user.Username, c.RealIP(), req.PermissionLevel)
	switch {
	case errors.Is(err, ErrInvalidLevel):
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrLastSuperuser):
		return echo.NewHTTPError(http.StatusConflict, err.Error())
	case errors.Is(err, ErrNotFound):
		return echo.NewHTTPError(http.StatusNotFound, err.Error())
	case err != nil:
		return err
	}
	return c.NoContent(http.StatusNoContent)
}

// ===== Helpers =====

func parseID(c echo.Context, key string) (int32, error) {
	raw := c.Param(key)
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}
	return int32(n), nil
}

func parseDate(s string) (pgtype.Date, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func formatDate(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
