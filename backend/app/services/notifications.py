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
    logger.info("[NOTIFICATION] %s -> %s: %s", channel, recipient, subject)
    print(f"[NOTIFICATION] {channel} | {recipient} | {subject}\n{body}\n")
    return payload
