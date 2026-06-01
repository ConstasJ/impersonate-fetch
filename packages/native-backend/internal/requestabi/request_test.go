package requestabi

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

type bufferedResponse struct {
	ID         string              `json:"id"`
	URL        string              `json:"url"`
	StatusCode int                 `json:"status_code"`
	Headers    map[string][]string `json:"headers"`
	Cookies    []map[string]any    `json:"cookies"`
	Content    string              `json:"content"`
	Raw        string              `json:"raw"`
	Err        string              `json:"err"`
}

func TestHandleRequestJSONReportsReferenceErrors(t *testing.T) {
	cases := []struct {
		name    string
		payload string
		wantErr string
	}{
		{
			name:    "invalid json",
			payload: `{`,
			wantErr: "request->err := json.Unmarshal([]byte(requestParamsString), &requestParams) failed: ",
		},
		{
			name:    "missing method",
			payload: `{"Id":"session-1","Url":"https://example.test"}`,
			wantErr: "request->req, err := buildRequest(requestParams) failed: method is null",
		},
		{
			name:    "missing url",
			payload: `{"Id":"session-1","Method":"GET"}`,
			wantErr: "request->req, err := buildRequest(requestParams) failed: url is null",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payload, id := HandleRequestJSON(tc.payload)
			if id != "" {
				t.Fatalf("error response should not allocate id, got %q", id)
			}
			var response bufferedResponse
			if err := json.Unmarshal([]byte(payload), &response); err != nil {
				t.Fatalf("response is not JSON: %v", err)
			}
			if !strings.HasPrefix(response.Err, tc.wantErr) {
				t.Fatalf("unexpected err %q, want prefix %q", response.Err, tc.wantErr)
			}
		})
	}
}

func TestHandleRequestJSONReturnsBufferedNativeResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method %s", r.Method)
		}
		if got := r.URL.Query().Get("q"); got != "value" {
			t.Fatalf("unexpected query value %q", got)
		}
		if got := r.Header.Get("X-Test"); got != "yes" {
			t.Fatalf("unexpected header %q", got)
		}
		http.SetCookie(w, &http.Cookie{Name: "token", Value: "abc"})
		w.Header().Set("X-Reply", "ok")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("hello from backend"))
	}))
	defer server.Close()

	requestJSON := `{
		"Id":"session-1",
		"Method":"POST",
		"Url":"` + server.URL + `",
		"Params":{"q":"value"},
		"Headers":{"X-Test":"yes"}
	}`

	payload, id := HandleRequestJSON(requestJSON)
	if id == "" {
		t.Fatalf("expected allocated response id")
	}

	var response bufferedResponse
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		t.Fatalf("response is not JSON: %v", err)
	}
	if response.Err != "" {
		t.Fatalf("unexpected err: %s", response.Err)
	}
	if response.ID != id {
		t.Fatalf("response id %q does not match allocation id %q", response.ID, id)
	}
	if response.StatusCode != http.StatusCreated {
		t.Fatalf("unexpected status: %d", response.StatusCode)
	}
	if response.URL == "" {
		t.Fatalf("expected response url")
	}
	if got := response.Headers["X-Reply"]; len(got) != 1 || got[0] != "ok" {
		t.Fatalf("unexpected headers: %#v", response.Headers)
	}
	content, err := base64.StdEncoding.DecodeString(response.Content)
	if err != nil {
		t.Fatalf("content is not base64: %v", err)
	}
	if string(content) != "hello from backend" {
		t.Fatalf("unexpected content: %q", content)
	}
	if response.Raw == "" {
		t.Fatalf("expected raw response payload")
	}
}

func TestHandleRequestJSONReportsTransportErrorPrefix(t *testing.T) {
	payload, id := HandleRequestJSON(`{
		"Id":"session-transport-error",
		"Method":"GET",
		"Url":"http://127.0.0.1:1/unreachable",
		"Timeout":1
	}`)
	if id != "" {
		t.Fatalf("transport error should not allocate id, got %q", id)
	}

	var response bufferedResponse
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		t.Fatalf("response is not JSON: %v", err)
	}
	if !strings.HasPrefix(response.Err, "request->response, err := GetSession(requestParams.Id).Request(requestParams.Method, requestParams.Url, req) failed: ") {
		t.Fatalf("unexpected transport err prefix: %q", response.Err)
	}
}

func TestRequestMarshalErrorPrefixesStayReferenceCompatible(t *testing.T) {
	source, err := os.ReadFile("request.go")
	if err != nil {
		t.Fatalf("read request.go: %v", err)
	}
	for _, prefix := range []string{
		"request->responseParamsString, err := json.Marshal(responseParams) failed: ",
		"stream_request->json.Marshal failed: ",
		"stream_read->json.Marshal failed: ",
	} {
		if !strings.Contains(string(source), prefix) {
			t.Fatalf("missing marshal prefix %q", prefix)
		}
	}
}
