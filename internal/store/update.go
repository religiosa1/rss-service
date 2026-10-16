package store

import (
	"database/sql"
	"database/sql/driver"
	"strings"
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

// optionalField is a model.Optional of any type.
type optionalField interface {
	driver.Valuer
	IsSet() bool
}

// addIfSet adds the column, if the field is present in the payload; null is
// stored as NULL, validation rejects it for non-nullable columns.
func (s *updateSet) addIfSet(column string, field optionalField) {
	if field.IsSet() {
		s.add(column, field)
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
