/**
 * POST Form Data Example
 *
 * Demonstrates sending form data in POST requests.
 * This mirrors Python requests_go POST with data parameter.
 */

import { fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== POST Form Data Example ===\n');

  try {
    // Method 1: Using URLSearchParams for form data
    console.log('Method 1: Using URLSearchParams');
    const formData1 = new URLSearchParams();
    formData1.append('username', 'john_doe');
    formData1.append('password', 'secret123');
    formData1.append('remember_me', 'true');

    console.log('Sending form data:', formData1.toString());

    const response1 = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData1.toString(),
      tls: TLS_CHROME_LATEST,
    });

    const data1 = (await response1.json()) as { form?: unknown };
    console.log('Response Status:', response1.status);
    console.log('Form data received:', data1.form);
    console.log('');

    // Method 2: Using FormData (multipart/form-data)
    console.log('Method 2: Using FormData (multipart)');
    const formData2 = new FormData();
    formData2.append('field1', 'value1');
    formData2.append('field2', 'value2');
    formData2.append('file_field', new Blob(['file content']), 'example.txt');

    const response2 = await fetch('https://httpbin.org/post', {
      method: 'POST',
      body: formData2,
      tls: TLS_CHROME_LATEST,
    });

    const data2 = (await response2.json()) as { files?: unknown; form?: unknown };
    console.log('Response Status:', response2.status);
    console.log('Form data received:', data2.form);
    console.log('Files received:', data2.files);
    console.log('');

    // Method 3: Plain string (for simple cases)
    console.log('Method 3: Plain string');
    const formString = 'name=Alice&age=25&city=New+York';

    const response3 = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formString,
      tls: TLS_CHROME_LATEST,
    });

    const data3 = (await response3.json()) as { form?: unknown };
    console.log('Response Status:', response3.status);
    console.log('Form data received:', data3.form);

    console.log('\n✓ POST form data example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
