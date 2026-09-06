import logging

logger = logging.getLogger(__name__)


def send_notification(channel: str, recipient: str, subject: str, body: str) -> dict:
    payload = {
        "channel": channel,
        "recipient": recipient,
        "subject": subject,
        "body": body,
        "status": "sent",
    }
    logger.info("[NOTIFICATION] %s -> %s: %s | %.200s", channel, recipient, subject, body)
    return payload
