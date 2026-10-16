package model

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// ISOLayout matches JS Date.toISOString(), which the node.js version used in
// its responses: UTC, always with milliseconds.
const ISOLayout = "2006-01-02T15:04:05.000Z07:00"

// Timestamp is a time stored in DB as integer unix milliseconds (drizzle's
// timestamp_ms mode) and marshalled to JSON in ISOLayout.
type Timestamp struct {
	time.Time
}

func NewTimestamp(t time.Time) Timestamp {
	return Timestamp{t.UTC().Truncate(time.Millisecond)}
}

func (t Timestamp) MarshalJSON() ([]byte, error) {
	return []byte(`"` + t.UTC().Format(ISOLayout) + `"`), nil
}

func (t *Timestamp) UnmarshalJSON(data []byte) error {
	var parsed time.Time
	if err := parsed.UnmarshalJSON(data); err != nil {
		return err
	}
	*t = NewTimestamp(parsed)
	return nil
}

func (t Timestamp) Value() (driver.Value, error) {
	return t.UnixMilli(), nil
}

func (t *Timestamp) Scan(src any) error {
	ms, ok := src.(int64)
	if !ok {
		return fmt.Errorf("cannot scan %T into Timestamp", src)
	}
	t.Time = time.UnixMilli(ms).UTC()
	return nil
}
