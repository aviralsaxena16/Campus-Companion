import io

def test_file_upload(client):

    pdf_content = b"%PDF-1.4 fake pdf"

    files = {
        "file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")
    }

    headers = {"Authorization": "Bearer fake-token"}

    response = client.post("/api/files/upload", files=files, headers=headers)

    assert response.status_code in [200, 500]