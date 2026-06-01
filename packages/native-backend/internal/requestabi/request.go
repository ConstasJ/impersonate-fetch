package requestabi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	chttp "github.com/wangluozhe/chttp"
	"github.com/wangluozhe/chttp/cookiejar"
	"github.com/wangluozhe/requests"
	"github.com/wangluozhe/requests/libs"
	ja3 "github.com/wangluozhe/requests/transport"
	requesturl "github.com/wangluozhe/requests/url"
)

var sessionsPool sync.Map

type nativeResponsePayload struct {
	ID         string              `json:"id"`
	URL        string              `json:"url"`
	Headers    map[string][]string `json:"headers"`
	Cookies    any                 `json:"cookies"`
	StatusCode int                 `json:"status_code"`
	Content    string              `json:"content"`
	Raw        []byte              `json:"raw"`
	Err        string              `json:"err,omitempty"`
}

func HandleRequestJSON(requestParamsString string) (string, string) {
	requestParams := libs.RequestParams{}
	if err := json.Unmarshal([]byte(requestParamsString), &requestParams); err != nil {
		return errorResponse("request->err := json.Unmarshal([]byte(requestParamsString), &requestParams) failed: " + err.Error()), ""
	}

	req, err := buildRequest(requestParams)
	if err != nil {
		return errorResponse("request->req, err := buildRequest(requestParams) failed: " + err.Error()), ""
	}

	response, err := getSession(requestParams.Id).Request(requestParams.Method, requestParams.Url, req)
	if err != nil {
		return errorResponse("request->response, err := GetSession(requestParams.Id).Request(requestParams.Method, requestParams.Url, req) failed: " + err.Error()), ""
	}
	defer response.Body.Close()

	responseID := uuid.New().String()
	payload := nativeResponsePayload{
		ID:         responseID,
		URL:        response.Url,
		Headers:    response.Headers,
		Cookies:    response.Cookies,
		StatusCode: response.StatusCode,
		Content:    base64.StdEncoding.EncodeToString(response.Content),
		Raw:        response.RawResponse,
	}
	responseJSON, err := json.Marshal(payload)
	if err != nil {
		return errorResponse("request->responseParamsString, err := json.Marshal(responseParams) failed: " + err.Error()), ""
	}

	return string(responseJSON), responseID
}

func FreeSession(id string) {
	sessionsPool.Delete(id)
}

func getSession(id string) *requests.Session {
	cookies, _ := cookiejar.New(nil)
	if actual, ok := sessionsPool.Load(id); ok {
		session := actual.(*requests.Session)
		session.Cookies = cookies
		return session
	}

	session := requests.NewSession()
	session.Cookies = cookies
	actual, _ := sessionsPool.LoadOrStore(id, session)
	return actual.(*requests.Session)
}

func buildRequest(requestParams libs.RequestParams) (*requesturl.Request, error) {
	if requestParams.Method == "" {
		return nil, errors.New("method is null")
	}
	if requestParams.Url == "" {
		return nil, errors.New("url is null")
	}

	req := requesturl.NewRequest()
	if requestParams.Params != nil {
		params := requesturl.NewParams()
		for key, value := range requestParams.Params {
			params.Set(key, value)
		}
		req.Params = params
	}

	if requestParams.Headers != nil {
		headers := requesturl.NewHeaders()
		if requestParams.UnChangedHeaderKey != nil {
			(*headers)[chttp.UnChangedHeaderKey] = requestParams.UnChangedHeaderKey
		}
		if requestParams.HeadersOrder != nil {
			(*headers)[chttp.HeaderOrderKey] = requestParams.HeadersOrder
		}
		for key, value := range requestParams.Headers {
			if strings.ToLower(key) != "content-length" {
				headers.Set(key, value)
			}
		}
		req.Headers = headers
	}

	if requestParams.Cookies != nil {
		cookies, _ := cookiejar.New(nil)
		parsedURL, _ := url.Parse(requestParams.Url)
		for key, value := range requestParams.Cookies {
			cookies.SetCookies(parsedURL, []*chttp.Cookie{{Name: key, Value: value}})
		}
		req.Cookies = cookies
	}

	if requestParams.Data != nil {
		data := requesturl.NewData()
		for key, value := range requestParams.Data {
			data.Set(key, value)
		}
		req.Data = data
	}
	if requestParams.Json != nil {
		req.Json = requestParams.Json
	}
	if requestParams.Body != "" {
		body, err := base64.StdEncoding.DecodeString(requestParams.Body)
		if err != nil {
			return nil, err
		}
		req.Body = bytes.NewReader(body)
	}
	if requestParams.Auth != nil {
		req.Auth = requestParams.Auth
	}
	if requestParams.Timeout != 0 {
		req.Timeout = time.Duration(requestParams.Timeout) * time.Second
	}
	req.AllowRedirects = requesturl.Bool(requestParams.AllowRedirects)
	if requestParams.Proxies != "" {
		req.Proxies = requestParams.Proxies
	}
	req.Verify = requesturl.Bool(requestParams.Verify)
	if requestParams.Cert != nil {
		req.Cert = requestParams.Cert
	}
	if requestParams.Ja3 != "" {
		req.Ja3 = requestParams.Ja3
	}
	if requestParams.RandomJA3 {
		req.RandomJA3 = requesturl.Bool(requestParams.RandomJA3)
	}
	if requestParams.ForceHTTP1 {
		req.ForceHTTP1 = requesturl.Bool(requestParams.ForceHTTP1)
	}
	if requestParams.PseudoHeaderOrder != nil {
		if req.Headers == nil {
			req.Headers = requesturl.NewHeaders()
		}
		(*req.GetHeaders())[chttp.PHeaderOrderKey] = requestParams.PseudoHeaderOrder
	}
	if requestParams.TLSExtensions != "" {
		tlsExtensions := &ja3.Extensions{}
		if err := json.Unmarshal([]byte(requestParams.TLSExtensions), tlsExtensions); err != nil {
			return nil, err
		}
		req.TLSExtensions = ja3.ToTLSExtensions(tlsExtensions)
	}
	if requestParams.HTTP2Settings != "" {
		http2Settings := &ja3.H2Settings{}
		if err := json.Unmarshal([]byte(requestParams.HTTP2Settings), http2Settings); err != nil {
			return nil, err
		}
		req.HTTP2Settings = ja3.ToHTTP2Settings(http2Settings)
	}
	if requestParams.Stream {
		req.Stream = true
	}

	return req, nil
}

func errorResponse(message string) string {
	payload, err := json.Marshal(nativeResponsePayload{Err: message})
	if err != nil {
		return fmt.Sprintf(`{"err":%q}`, message)
	}
	return string(payload)
}
