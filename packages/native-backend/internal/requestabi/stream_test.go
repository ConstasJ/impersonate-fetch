package requestabi

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type streamOpenResponse struct {
	StreamID   string              `json:"stream_id"`
	URL        string              `json:"url"`
	Headers    map[string][]string `json:"headers"`
	Cookies    []map[string]any    `json:"cookies"`
	StatusCode int                 `json:"status_code"`
	Err        string              `json:"err"`
}

type streamReadResponse struct {
	Data string `json:"data"`
	EOF  bool   `json:"eof"`
	Err  string `json:"err"`
}

func TestStreamLifecycleReadsChunksAndCloses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method %s", r.Method)
		}
		w.Header().Set("X-Stream", "ok")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("hello stream"))
	}))
	defer server.Close()

	openPayload, streamID := HandleStreamRequestJSON(`{"Id":"stream-session","Method":"GET","Url":"` + server.URL + `"}`)
	if streamID == "" {
		t.Fatalf("expected stream id")
	}
	var open streamOpenResponse
	if err := json.Unmarshal([]byte(openPayload), &open); err != nil {
		t.Fatalf("open response is not JSON: %v", err)
	}
	if open.Err != "" {
		t.Fatalf("unexpected open err: %s", open.Err)
	}
	if open.StreamID != streamID {
		t.Fatalf("open stream id %q does not match allocation id %q", open.StreamID, streamID)
	}
	if open.StatusCode != http.StatusAccepted {
		t.Fatalf("unexpected status: %d", open.StatusCode)
	}

	firstPayload, firstID := HandleStreamRead(streamID, 5)
	if firstID != streamID+"_read" {
		t.Fatalf("unexpected read allocation id %q", firstID)
	}
	first := decodeStreamRead(t, firstPayload)
	if first.Err != "" {
		t.Fatalf("unexpected first read err: %s", first.Err)
	}
	if decodeBase64(t, first.Data) != "hello" {
		t.Fatalf("unexpected first data: %q", decodeBase64(t, first.Data))
	}
	if first.EOF {
		t.Fatalf("first read should not be eof")
	}

	secondPayload, secondID := HandleStreamRead(streamID, 0)
	if secondID != streamID+"_read" {
		t.Fatalf("unexpected second read allocation id %q", secondID)
	}
	second := decodeStreamRead(t, secondPayload)
	if second.Err != "" {
		t.Fatalf("unexpected second read err: %s", second.Err)
	}
	if decodeBase64(t, second.Data) != " stream" {
		t.Fatalf("unexpected second data: %q", decodeBase64(t, second.Data))
	}

	third := decodeStreamRead(t, mustReadPayload(t, streamID, 5))
	if third.Err != "" {
		t.Fatalf("unexpected third read err: %s", third.Err)
	}
	if third.Data != "" || !third.EOF {
		t.Fatalf("expected EOF with empty data, got data=%q eof=%v", third.Data, third.EOF)
	}

	CloseStream(streamID)
	closed := decodeStreamRead(t, mustReadPayload(t, streamID, 5))
	if !strings.HasPrefix(closed.Err, "stream_read->stream not found: "+streamID) {
		t.Fatalf("unexpected closed stream error: %q", closed.Err)
	}
}

func TestHandleStreamRequestJSONReportsReferenceErrors(t *testing.T) {
	for _, tc := range []struct {
		name    string
		payload string
		wantErr string
	}{
		{
			name:    "invalid json",
			payload: `{`,
			wantErr: "stream_request->json.Unmarshal failed: ",
		},
		{
			name:    "missing method",
			payload: `{"Id":"stream-session","Url":"https://example.test"}`,
			wantErr: "stream_request->buildRequest failed: method is null",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			payload, streamID := HandleStreamRequestJSON(tc.payload)
			if streamID != "" {
				t.Fatalf("error response should not allocate stream id, got %q", streamID)
			}
			var response streamOpenResponse
			if err := json.Unmarshal([]byte(payload), &response); err != nil {
				t.Fatalf("response is not JSON: %v", err)
			}
			if !strings.HasPrefix(response.Err, tc.wantErr) {
				t.Fatalf("unexpected err %q, want prefix %q", response.Err, tc.wantErr)
			}
		})
	}
}

func mustReadPayload(t *testing.T, streamID string, size int) string {
	t.Helper()
	payload, _ := HandleStreamRead(streamID, size)
	return payload
}

func decodeStreamRead(t *testing.T, payload string) streamReadResponse {
	t.Helper()
	var response streamReadResponse
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		t.Fatalf("read response is not JSON: %v", err)
	}
	return response
}

func decodeBase64(t *testing.T, value string) string {
	t.Helper()
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		t.Fatalf("value is not base64: %v", err)
	}
	return string(decoded)
}
