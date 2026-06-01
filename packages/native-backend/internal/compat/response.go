package compat

import "encoding/json"

const stubID = "phase1-source-backend-stub"

type nativeResponsePayload struct {
	ID         string              `json:"id"`
	URL        string              `json:"url"`
	StatusCode int                 `json:"status_code"`
	Headers    map[string][]string `json:"headers"`
	Cookies    []any               `json:"cookies"`
	Content    string              `json:"content"`
	Raw        string              `json:"raw"`
	Err        string              `json:"err"`
}

type nativeStreamReadPayload struct {
	StreamID string `json:"stream_id"`
	Data     string `json:"data"`
	EOF      bool   `json:"eof"`
	Err      string `json:"err"`
}

func UnsupportedRequestResponse(method string) string {
	return mustMarshal(nativeResponsePayload{
		ID:         stubID,
		URL:        "",
		StatusCode: 0,
		Headers:    map[string][]string{},
		Cookies:    []any{},
		Content:    "",
		Raw:        "",
		Err:        "source backend ABI stub: " + method + " is not implemented in Phase 1 setup",
	})
}

func UnsupportedStreamReadResponse(streamID string) string {
	return mustMarshal(nativeStreamReadPayload{
		StreamID: streamID,
		Data:     "",
		EOF:      true,
		Err:      "source backend ABI stub: stream_read is not implemented in Phase 1 setup",
	})
}

func StubID() string {
	return stubID
}

func mustMarshal(value any) string {
	payload, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}

	return string(payload)
}
