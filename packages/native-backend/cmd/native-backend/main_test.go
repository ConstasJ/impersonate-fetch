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
	first := storeResponse("stream-id_read", `{"data":"first"}`)
	if first == nil {
		t.Fatal("expected first pointer to be non-nil")
	}
	storedFirst, ok := responsePointers.Load("stream-id_read")
	if !ok {
		t.Fatal("expected first pointer to be stored")
	}
	if storedFirst != first {
		t.Fatal("expected first stored pointer to match returned pointer")
	}

	second := storeResponse("stream-id_read", `{"data":"second"}`)
	if second == nil {
		t.Fatal("expected replacement pointer to be non-nil")
	}
	storedSecond, ok := responsePointers.Load("stream-id_read")
	if !ok {
		t.Fatal("expected replacement pointer to be stored")
	}
	if storedSecond != second {
		t.Fatal("expected replacement stored pointer to match returned pointer")
	}

	freeStoredResponse("stream-id_read")
}
