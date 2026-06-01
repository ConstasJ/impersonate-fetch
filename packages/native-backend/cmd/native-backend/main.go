//go:build cgo

package main

/*
#include <stdlib.h>
*/
import "C"

import (
	"sync"
	"unsafe"

	"github.com/ConstasJ/impersonated-fetch/packages/native-backend/internal/compat"
)

var responsePointers sync.Map

//export request
func request(requestJSON *C.char) *C.char {
	return storeResponse(compat.StubID(), compat.UnsupportedRequestResponse("request"))
}

//export stream_request
func stream_request(requestJSON *C.char) *C.char {
	return storeResponse("phase1-source-backend-stub-stream", compat.UnsupportedRequestResponse("stream_request"))
}

//export stream_read
func stream_read(streamID *C.char, size C.int) *C.char {
	id := C.GoString(streamID)
	return storeResponse(id+"_read", compat.UnsupportedStreamReadResponse(id))
}

//export stream_close
func stream_close(streamID *C.char) {
	id := C.GoString(streamID)
	freeStoredResponse(id)
	freeStoredResponse(id + "_read")
}

//export freeMemory
func freeMemory(responseID *C.char) {
	freeStoredResponse(C.GoString(responseID))
}

//export freeSession
func freeSession(sessionID *C.char) {}

func storeResponse(id string, payload string) *C.char {
	freeStoredResponse(id)
	ptr := C.CString(payload)
	responsePointers.Store(id, ptr)
	return ptr
}

func freeStoredResponse(id string) {
	if value, ok := responsePointers.LoadAndDelete(id); ok {
		C.free(unsafe.Pointer(value.(*C.char)))
	}
}

func main() {}
