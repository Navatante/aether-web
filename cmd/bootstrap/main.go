// Bootstrap: configura la contraseña y/o el nivel de permiso de un usuario existente.
//
// Uso:
//
//	go run ./cmd/bootstrap -user jcarm20                          # contraseña por stdin (con eco)
//	go run ./cmd/bootstrap -user jcarm20 -password 'xxxx'         # contraseña por flag (no recomendado en producción)
//	AETHER_BOOTSTRAP_PASSWORD=xxxx go run ./cmd/bootstrap -user jcarm20
//	go run ./cmd/bootstrap -user jon -level Superusuario          # solo fija el nivel (sin tocar la contraseña)
//	go run ./cmd/bootstrap -user jon -password 'xxxx' -level Superusuario  # ambas cosas
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/14esc/aether-web/internal/auth"
	"github.com/14esc/aether-web/internal/db"
)

// validLevels son los niveles de permiso asignables (espejo del CHECK de BD).
var validLevels = map[string]struct{}{
	auth.PermComun:          {},
	auth.PermOperacional:    {},
	auth.PermAdministrativo: {},
	auth.PermSeguridad:      {},
	auth.PermSuperusuario:   {},
}

func main() {
	var (
		username = flag.String("user", "", "person_user a actualizar (obligatorio)")
		password = flag.String("password", "", "contraseña en claro (si vacía y sin -level, se lee de stdin o $AETHER_BOOTSTRAP_PASSWORD)")
		level    = flag.String("level", "", "person_permission_level a fijar (opcional): Común|Operacional|Administrativo|Seguridad|Superusuario")
	)
	flag.Parse()

	if *username == "" {
		fmt.Fprintln(os.Stderr, "error: -user es obligatorio")
		flag.Usage()
		os.Exit(2)
	}

	if *level != "" {
		if _, ok := validLevels[*level]; !ok {
			fmt.Fprintln(os.Stderr, "error: nivel inválido:", *level)
			os.Exit(2)
		}
	}

	// Resolver contraseña: flag > env > stdin. Si se indicó -level, la
	// contraseña es opcional (no se pregunta por stdin: permite fijar solo
	// el nivel sin tocar las credenciales).
	pwd := *password
	if pwd == "" {
		pwd = os.Getenv("AETHER_BOOTSTRAP_PASSWORD")
	}
	if pwd == "" && *level == "" {
		fmt.Fprint(os.Stderr, "Contraseña para ", *username, ": ")
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil {
			fmt.Fprintln(os.Stderr, "error leyendo stdin:", err)
			os.Exit(1)
		}
		pwd = strings.TrimRight(line, "\r\n")
	}

	if pwd == "" && *level == "" {
		fmt.Fprintln(os.Stderr, "error: nada que hacer (indica -password o -level)")
		os.Exit(2)
	}

	dsn := os.Getenv("AETHER_DATABASE_URL")
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "error: AETHER_DATABASE_URL no está definida")
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := db.New(ctx, db.DefaultConfig(dsn))
	if err != nil {
		fmt.Fprintln(os.Stderr, "error conectando a la BD:", err)
		os.Exit(1)
	}
	defer pool.Close()

	svc := auth.NewService(pool, 0)

	if pwd != "" {
		n, err := svc.SetPassword(ctx, *username, pwd)
		if err != nil {
			fmt.Fprintln(os.Stderr, "error actualizando contraseña:", err)
			os.Exit(1)
		}
		if n == 0 {
			fmt.Fprintln(os.Stderr, "usuario no encontrado:", *username)
			os.Exit(1)
		}
		fmt.Printf("OK: contraseña actualizada para %s\n", *username)
	}

	if *level != "" {
		n, err := svc.SetPermissionLevel(ctx, *username, *level)
		if err != nil {
			fmt.Fprintln(os.Stderr, "error actualizando nivel de permiso:", err)
			os.Exit(1)
		}
		if n == 0 {
			fmt.Fprintln(os.Stderr, "usuario no encontrado:", *username)
			os.Exit(1)
		}
		fmt.Printf("OK: nivel '%s' fijado para %s\n", *level, *username)
	}
}
