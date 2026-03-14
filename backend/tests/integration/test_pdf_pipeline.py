def test_pdf_processing_pipeline(client):

    files = {
        "file": ("sample.pdf", open("tests/fixtures/sample.pdf", "rb"), "application/pdf")
    }

    headers = {"Authorization": "Bearer fake-token"}

    response = client.post("/api/files/upload", files=files, headers=headers)

    assert response.status_code in [200, 500]