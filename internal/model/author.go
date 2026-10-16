package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"

	"github.com/invopop/validation"
)

// Author is a person related to a feed or a feed item. Stored as JSON text.
type Author struct {
	Name   string `json:"name,omitzero"`
	Email  string `json:"email,omitzero"`
	Link   string `json:"link,omitzero"`
	Avatar string `json:"avatar,omitzero"`
}

func (a Author) Validate() error {
	return validation.ValidateStruct(&a,
		validation.Field(&a.Name, validation.RuneLength(0, 254)),
		validation.Field(&a.Email, validation.RuneLength(0, 254)),
		validation.Field(&a.Link, validation.RuneLength(0, URLLength), isURL),
		validation.Field(&a.Avatar, validation.RuneLength(0, URLLength), isURL),
	)
}

func (a Author) Value() (driver.Value, error) {
	return marshalColumn(a)
}

func (a *Author) Scan(src any) error {
	return scanColumn(src, a)
}

// Authors is a list of authors stored as JSON text; nil is stored as NULL.
type Authors []Author

func (a Authors) Value() (driver.Value, error) {
	if a == nil {
		return nil, nil
	}
	return marshalColumn(a)
}

func (a *Authors) Scan(src any) error {
	return scanColumn(src, a)
}

func marshalColumn(v any) (driver.Value, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

func scanColumn(src any, dest any) error {
	switch src := src.(type) {
	case nil:
		return nil
	case string:
		return json.Unmarshal([]byte(src), dest)
	case []byte:
		return json.Unmarshal(src, dest)
	default:
		return fmt.Errorf("cannot scan %T into %T", src, dest)
	}
}
