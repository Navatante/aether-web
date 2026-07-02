package httpx

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

// IDParam extrae el path param `name` como ID positivo de 32 bits. Si no lo
// es, devuelve un *echo.HTTPError 400 listo para retornar desde el handler.
// Sustituye a los parseID/parseIDParam/parsePathID que cada dominio duplicaba.
func IDParam(c echo.Context, name string) (int32, error) {
	n, err := strconv.ParseInt(c.Param(name), 10, 32)
	if err != nil || n <= 0 {
		return 0, echo.NewHTTPError(http.StatusBadRequest, "invalid "+name)
	}
	return int32(n), nil
}
