package store

import (
	"database/sql"
	"strings"

	"github.com/religiosa1/rss-service/internal/model"
)

// updateSet collects SET clause of an UPDATE from the fields present in a
// patch payload.
type updateSet struct {
	columns []string
	args    []any
}

func (s *updateSet) add(column string, value any) {
	s.columns = append(s.columns, column+" = ?")
	s.args = append(s.args, value)
}

func (s *updateSet) query(table, where string, whereArgs ...any) (string, []any) {
	query := "UPDATE " + table + " SET " + strings.Join(s.columns, ", ") + " WHERE " + where
	return query, append(s.args, whereArgs...)
}

// addValue adds a non-nullable column, if the field is present.
func addValue[T any](s *updateSet, column string, field model.Optional[T]) {
	if value, ok := field.Get(); ok {
		s.add(column, value)
	}
}

// addNullable adds a nullable column, if the field is present or null.
func addNullable[T any](s *updateSet, column string, field model.Optional[T]) {
	if field.IsSet() {
		s.add(column, field.Ptr())
	}
}

func checkAffected(res sql.Result, err error) error {
	if err != nil {
		return mapError(err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}
