package compat

import (
	"encoding/json"
	"testing"
)

func TestUnsupportedRequestResponseUsesNativeResponseShape(t *testing.T) {
	payload := UnsupportedRequestResponse("request")

	var response map[string]any
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		t.Fatalf("response is not JSON: %v", err)
	}

	for _, field := range []string{"id", "url", "status_code", "headers", "cookies", "content", "raw", "err"} {
		if _, ok := response[field]; !ok {
			t.Fatalf("missing field %q in %s", field, payload)
		}
	}

	if response["err"] != "source backend ABI stub: request is not implemented in Phase 1 setup" {
		t.Fatalf("unexpected err: %v", response["err"])
	}
}

func TestUnsupportedStreamReadResponseUsesStreamShape(t *testing.T) {
	payload := UnsupportedStreamReadResponse("stream-1")

	var response map[string]any
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		t.Fatalf("response is not JSON: %v", err)
	}

	if response["stream_id"] != "stream-1" {
		t.Fatalf("unexpected stream_id: %v", response["stream_id"])
	}
	if response["data"] != "" {
		t.Fatalf("unexpected data: %v", response["data"])
	}
	if response["eof"] != true {
		t.Fatalf("expected eof true, got %v", response["eof"])
	}
	if response["err"] != "source backend ABI stub: stream_read is not implemented in Phase 1 setup" {
		t.Fatalf("unexpected err: %v", response["err"])
	}
}
