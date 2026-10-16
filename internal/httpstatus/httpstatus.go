// Package httpstatus captures the response status of an http handler, for
// middlewares reporting it.
package httpstatus

import "net/http"

// Writer is an http.ResponseWriter recording the response status.
type Writer struct {
	http.ResponseWriter
	Status      int
	WroteHeader bool
}

// Wrap returns w as a Writer, reusing it if it's already one, so stacked
// middlewares don't wrap the response twice.
func Wrap(w http.ResponseWriter) *Writer {
	if sw, ok := w.(*Writer); ok {
		return sw
	}
	return &Writer{ResponseWriter: w, Status: http.StatusOK}
}

func (w *Writer) WriteHeader(code int) {
	if !w.WroteHeader {
		w.Status = code
		w.WroteHeader = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *Writer) Write(b []byte) (int, error) {
	w.WroteHeader = true
	return w.ResponseWriter.Write(b)
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (w *Writer) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}
