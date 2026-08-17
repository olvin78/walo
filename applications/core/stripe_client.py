from __future__ import annotations

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

STRIPE_API_BASE = "https://api.stripe.com/v1"


class StripeError(Exception):
    pass


def _auth():
    return (settings.STRIPE_SECRET_KEY, "")


def create_subscription_checkout_session(*, user_id: int, success_url: str, cancel_url: str) -> dict:
    """Crea una sesión de Stripe Checkout para la suscripción PRO recurrente mensual
    (tarjeta + Google Pay + Apple Pay automáticos), ligada al usuario que paga.
    Cada usuario se renueva un mes después de su propia fecha de activación
    (estilo Amazon Prime), sin fecha de facturación compartida.
    """
    amount_cents = int(round(float(settings.PAYPAL_PRO_PRICE) * 100))
    payload = {
        "mode": "subscription",
        "client_reference_id": str(user_id),
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": settings.PAYPAL_PRO_CURRENCY.lower(),
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][price_data][recurring][interval]": "month",
        "line_items[0][price_data][product_data][name]": "Igualo PRO (suscripción mensual)",
        "metadata[user_id]": str(user_id),
        # Managed Payments (nuevo, activado por defecto en cuentas recientes) exige un
        # código fiscal de producto que no aplica a esta suscripción digital simple.
        "managed_payments[enabled]": "false",
    }
    response = requests.post(
        f"{STRIPE_API_BASE}/checkout/sessions",
        data=payload,
        auth=_auth(),
        timeout=15,
    )
    if not response.ok:
        logger.error("Stripe create subscription session failed: %s %s", response.status_code, response.text)
        raise StripeError("No se pudo crear la sesión de pago de Stripe.")
    return response.json()


def retrieve_checkout_session(*, session_id: str) -> dict:
    response = requests.get(
        f"{STRIPE_API_BASE}/checkout/sessions/{session_id}",
        auth=_auth(),
        timeout=15,
    )
    if not response.ok:
        logger.error("Stripe retrieve session failed: %s %s", response.status_code, response.text)
        raise StripeError("No se pudo confirmar el pago con Stripe.")
    return response.json()


def get_current_period_end(subscription: dict) -> int:
    """`current_period_end` vive en distintos lugares según la versión de la API
    de Stripe: en el nivel superior de la suscripción (versiones antiguas) o
    dentro de cada subscription item (versiones nuevas)."""
    if subscription.get("current_period_end"):
        return subscription["current_period_end"]
    items = (subscription.get("items") or {}).get("data") or []
    if items and items[0].get("current_period_end"):
        return items[0]["current_period_end"]
    raise StripeError("No se pudo determinar la fecha de fin del período de la suscripción.")


def retrieve_subscription(*, subscription_id: str) -> dict:
    response = requests.get(
        f"{STRIPE_API_BASE}/subscriptions/{subscription_id}",
        auth=_auth(),
        timeout=15,
    )
    if not response.ok:
        logger.error("Stripe retrieve subscription failed: %s %s", response.status_code, response.text)
        raise StripeError("No se pudo consultar la suscripción de Stripe.")
    return response.json()


def cancel_at_period_end(*, subscription_id: str) -> dict:
    """Cancela la renovación futura; el usuario conserva el PRO hasta que termine
    el período ya pagado. Sin reembolso."""
    response = requests.post(
        f"{STRIPE_API_BASE}/subscriptions/{subscription_id}",
        data={"cancel_at_period_end": "true"},
        auth=_auth(),
        timeout=15,
    )
    if not response.ok:
        logger.error("Stripe cancel_at_period_end failed: %s %s", response.status_code, response.text)
        raise StripeError("No se pudo cancelar la suscripción de Stripe.")
    return response.json()


def cancel_immediately(*, subscription_id: str) -> dict:
    response = requests.delete(
        f"{STRIPE_API_BASE}/subscriptions/{subscription_id}",
        auth=_auth(),
        timeout=15,
    )
    if not response.ok:
        logger.error("Stripe cancel_immediately failed: %s %s", response.status_code, response.text)
        raise StripeError("No se pudo cancelar la suscripción de Stripe.")
    return response.json()


def refund_latest_invoice(*, subscription_id: str) -> dict | None:
    """Reembolsa el cargo del período actual (regla de las 12 horas desde la
    activación). Devuelve None si no había nada que reembolsar.

    Desde que Stripe introdujo el objeto Invoice Payment, la factura ya no trae
    directamente el payment_intent — hay que consultarlo aparte vía
    /v1/invoice_payments?invoice={id}.
    """
    sub = retrieve_subscription(subscription_id=subscription_id)
    latest_invoice = sub.get("latest_invoice")
    invoice_id = latest_invoice.get("id") if isinstance(latest_invoice, dict) else latest_invoice
    if not invoice_id:
        return None

    payments_resp = requests.get(
        f"{STRIPE_API_BASE}/invoice_payments", params={"invoice": invoice_id}, auth=_auth(), timeout=15
    )
    if not payments_resp.ok:
        logger.error("Stripe list invoice_payments failed: %s %s", payments_resp.status_code, payments_resp.text)
        raise StripeError("No se pudo consultar el pago de la factura en Stripe.")

    payment_intent_id = None
    for invoice_payment in payments_resp.json().get("data", []):
        payment = invoice_payment.get("payment") or {}
        if payment.get("type") == "payment_intent" and payment.get("payment_intent"):
            payment_intent_id = payment["payment_intent"]
            break
    if not payment_intent_id:
        return None
    response = requests.post(
        f"{STRIPE_API_BASE}/refunds",
        data={"payment_intent": payment_intent_id},
        auth=_auth(),
        timeout=15,
    )
    if not response.ok:
        logger.error("Stripe refund failed: %s %s", response.status_code, response.text)
        raise StripeError("No se pudo procesar el reembolso de Stripe.")
    return response.json()
