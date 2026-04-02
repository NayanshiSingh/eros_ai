from httpx import AsyncClient


class TestCors:
    async def test_preflight_allows_lan_frontend_origin(self, client: AsyncClient):
        response = await client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://192.168.1.17:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://192.168.1.17:3000"
