// Bootstrap: configura la contraseña de un usuario existente.
//
// Uso:
//
//	go run ./cmd/bootstrap -user jcarm20                    # lee de stdin (con eco)
//	go run ./cmd/bootstrap -user jcarm20 -password 'xxxx'   # pasa por flag (no recomendado en producción)
//	AETHER_BOOTSTRAP_PASSWORD=xxxx go run ./cmd/bootstrap -user jcarm20
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

func main() {
	var (
		username = flag.String("user", "", "person_user a actualizar (obligatorio)")
		password = flag.String("password", "", "contraseña en claro (si vacía, se lee de stdin o $AETHER_BOOTSTRAP_PASSWORD)")
	)
	flag.Parse()

	if *username == "" {
		fmt.Fprintln(os.Stderr, "error: -user es obligatorio")
		flag.Usage()
		os.Exit(2)
	}

	pwd := *password
	if pwd == "" {
		pwd = os.Getenv("AETHER_BOOTSTRAP_PASSWORD")
	}
	if pwd == "" {
		fmt.Fprint(os.Stderr, "Contraseña para ", *username, ": ")
		line, err := bufio.NewReader(os.Stdin).ReadString('\n')
		if err != nil {
			fmt.Fprintln(os.Stderr, "error leyendo stdin:", err)
			os.Exit(1)
		}
		pwd = strings.TrimRight(line, "\r\n")
	}
	if pwd == "" {
		fmt.Fprintln(os.Stderr, "error: contraseña vacía")
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := db.New(ctx, db.ConfigFromEnv())
	if err != nil {
		fmt.Fprintln(os.Stderr, "error conectando a la BD:", err)
		os.Exit(1)
	}
	defer pool.Close()

	svc := auth.NewService(pool, 0)
	n, err := svc.SetPassword(ctx, *username, pwd)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error actualizando contraseña:", err)
		os.Exit(1)
	}
	if n == 0 {
		fmt.Fprintln(os.Stderr, "usuario no encontrado:", *username)
		os.Exit(1)
	}
	fmt.Printf("OK: contraseña actualizada para %s (%d fila)\n", *username, n)
}
