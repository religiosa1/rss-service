package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"

	"github.com/invopop/validation"
)

type optionalState uint8

const (
	absent optionalState = iota
	null
	present
)

// Optional is a JSON payload field, which distinguishes a missing field from
// an explicit null: in PATCH-like payloads missing means "keep the current
// value", while null means "reset it".
type Optional[T any] struct {
	value T
	state optionalState
}

// Some returns a present Optional holding v.
func Some[T any](v T) Optional[T] {
	return Optional[T]{value: v, state: present}
}

// Null returns an explicitly nulled Optional.
func Null[T any]() Optional[T] {
	return Optional[T]{state: null}
}

// Get returns the value and whether it's present and not null.
func (o Optional[T]) Get() (T, bool) {
	return o.value, o.state == present
}

// IsSet reports whether the field was provided, null included.
func (o Optional[T]) IsSet() bool { return o.state != absent }

// IsNull reports whether the field was provided as an explicit null.
func (o Optional[T]) IsNull() bool { return o.state == null }

func (o *Optional[T]) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*o = Null[T]()
		return nil
	}
	if err := json.Unmarshal(data, &o.value); err != nil {
		return err
	}
	o.state = present
	return nil
}

func (o Optional[T]) MarshalJSON() ([]byte, error) {
	if o.state != present {
		return []byte("null"), nil
	}
	return json.Marshal(o.value)
}

// String formats the value for text logs.
func (o Optional[T]) String() string {
	switch o.state {
	case absent:
		return "<absent>"
	case null:
		return "null"
	default:
		return fmt.Sprintf("%+v", o.value)
	}
}

// Value stores absent and null fields as NULL. It also lets stock validation
// rules see through Optional, as they unwrap driver.Valuer (see validation.Indirect).
func (o Optional[T]) Value() (driver.Value, error) {
	if o.state != present {
		return nil, nil
	}
	return driver.DefaultParameterConverter.ConvertValue(o.value)
}

// Validate validates the held value, if it implements validation.Validatable
// or is a slice of those.
func (o Optional[T]) Validate() error {
	if o.state != present {
		return nil
	}
	return validation.Validate(o.value)
}

type setChecker interface {
	IsSet() bool
	IsNull() bool
}

var (
	errRequired = validation.NewError("required", "is required")
	errNotNull  = validation.NewError("not_null", "cannot be null")
)

// required rejects absent or null Optional fields.
var required = validation.By(func(value any) error {
	if o, ok := value.(setChecker); ok && (!o.IsSet() || o.IsNull()) {
		return errRequired
	}
	return nil
})

// notNull rejects null Optional fields, allowing absent ones.
var notNull = validation.By(func(value any) error {
	if o, ok := value.(setChecker); ok && o.IsNull() {
		return errNotNull
	}
	return nil
})
