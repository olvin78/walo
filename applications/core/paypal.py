from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class PayPalError(Exception):
    pass


def _get_access_token() -> str:
    response = requests.post(
        f"{settings.PAYPAL_API_BASE}/v1/oauth2/token",
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_SECRET),
        data={"grant_type": "client_credentials"},
        headers={"Accept": "application/json"},
        timeout=15,
    )
    if not response.ok:
        logger.error("PayPal auth failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo autenticar con PayPal.")
    return response.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def create_product() -> dict:
    token = _get_access_token()
    payload = {
        "name": "Igualo PRO",
        "description": "Suscripción mensual PRO de Igualo",
        "type": "SERVICE",
        "category": "SOFTWARE",
    }
    response = requests.post(
        f"{settings.PAYPAL_API_BASE}/v1/catalogs/products", json=payload, headers=_headers(token), timeout=15
    )
    if not response.ok:
        logger.error("PayPal create product failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo crear el producto de PayPal.")
    return response.json()


def create_plan(*, product_id: str) -> dict:
    """Plan de facturación mensual recurrente (sin fecha compartida: cada
    suscriptor se renueva un mes después de su propia fecha de alta)."""
    token = _get_access_token()
    payload = {
        "product_id": product_id,
        "name": "Igualo PRO mensual",
        "billing_cycles": [
            {
                "frequency": {"interval_unit": "MONTH", "interval_count": 1},
                "tenure_type": "REGULAR",
                "sequence": 1,
                "total_cycles": 0,  # 0 = indefinido, hasta que se cancele
                "pricing_scheme": {
                    "fixed_price": {
                        "value": settings.PAYPAL_PRO_PRICE,
                        "currency_code": settings.PAYPAL_PRO_CURRENCY,
                    }
                },
            }
        ],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "payment_failure_threshold": 1,
        },
    }
    response = requests.post(
        f"{settings.PAYPAL_API_BASE}/v1/billing/plans", json=payload, headers=_headers(token), timeout=15
    )
    if not response.ok:
        logger.error("PayPal create plan failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo crear el plan de PayPal.")
    return response.json()


def create_subscription(*, user_id: int, return_url: str, cancel_url: str) -> dict:
    token = _get_access_token()
    payload = {
        "plan_id": settings.PAYPAL_PLAN_ID,
        "custom_id": str(user_id),
        "application_context": {
            "return_url": return_url,
            "cancel_url": cancel_url,
            "user_action": "SUBSCRIBE_NOW",
            "shipping_preference": "NO_SHIPPING",
        },
    }
    response = requests.post(
        f"{settings.PAYPAL_API_BASE}/v1/billing/subscriptions", json=payload, headers=_headers(token), timeout=15
    )
    if not response.ok:
        logger.error("PayPal create subscription failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo crear la suscripción de PayPal.")
    return response.json()


def get_subscription(*, subscription_id: str) -> dict:
    token = _get_access_token()
    response = requests.get(
        f"{settings.PAYPAL_API_BASE}/v1/billing/subscriptions/{subscription_id}",
        headers=_headers(token),
        timeout=15,
    )
    if not response.ok:
        logger.error("PayPal get subscription failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo consultar la suscripción de PayPal.")
    return response.json()


def cancel_subscription(*, subscription_id: str, reason: str = "Cancelado por el usuario") -> None:
    token = _get_access_token()
    response = requests.post(
        f"{settings.PAYPAL_API_BASE}/v1/billing/subscriptions/{subscription_id}/cancel",
        json={"reason": reason},
        headers=_headers(token),
        timeout=15,
    )
    if response.status_code != 204:
        logger.error("PayPal cancel subscription failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo cancelar la suscripción de PayPal.")


def refund_latest_subscription_payment(*, subscription_id: str, start_time: str, end_time: str) -> dict | None:
    """Reembolsa el último cargo completado de la suscripción (regla de las 12
    horas). Devuelve None si no hay ningún cargo completado que reembolsar."""
    token = _get_access_token()
    response = requests.get(
        f"{settings.PAYPAL_API_BASE}/v1/billing/subscriptions/{subscription_id}/transactions",
        params={"start_time": start_time, "end_time": end_time},
        headers=_headers(token),
        timeout=15,
    )
    if not response.ok:
        logger.error("PayPal list subscription transactions failed: %s %s", response.status_code, response.text)
        raise PayPalError("No se pudo consultar los cargos de la suscripción de PayPal.")

    transactions = response.json().get("transactions", [])
    capture_id = next((t["id"] for t in transactions if t.get("status") == "COMPLETED"), None)
    if not capture_id:
        return None

    refund_response = requests.post(
        f"{settings.PAYPAL_API_BASE}/v2/payments/captures/{capture_id}/refund",
        json={},
        headers=_headers(token),
        timeout=15,
    )
    if not refund_response.ok:
        logger.error("PayPal refund capture failed: %s %s", refund_response.status_code, refund_response.text)
        raise PayPalError("No se pudo procesar el reembolso de PayPal.")
    return refund_response.json()
