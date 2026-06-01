//go:build cgo

package main

import "testing"

func TestFreeStoredResponseDeletesResponsePointer(t *testing.T) {
	storeResponse("response-id", `{"ok":true}`)
	if _, ok := responsePointers.Load("response-id"); !ok {
		t.Fatal("expected response pointer to be stored")
	}

	freeStoredResponse("response-id")
	if _, ok := responsePointers.Load("response-id"); ok {
		t.Fatal("expected response pointer to be deleted")
	}

	freeStoredResponse("response-id")
}

func TestStoreResponseReplacesPreviousPointer(t *testing.T) {
	storeResponse("stream-id_read", `{"data":"first"}`)
	first, ok := responsePointers.Load("stream-id_read")
	if !ok {
		t.Fatal("expected first pointer to be stored")
	}

	storeResponse("stream-id_read", `{"data":"second"}`)
	second, ok := responsePointers.Load("stream-id_read")
	if !ok {
		t.Fatal("expected replacement pointer to be stored")
	}
	if first == second {
		t.Fatal("expected replacement pointer to differ from first pointer")
	}

	freeStoredResponse("stream-id_read")
}
