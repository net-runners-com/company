from abc import ABC, abstractmethod

class ConnectorHandler(ABC):
    def __init__(self, connector_id: str, config: dict):
        self.connector_id = connector_id
        self.config = config

    @abstractmethod
    async def receive_webhook(self, request) -> dict:
        ...

    @abstractmethod
    async def verify(self) -> dict:
        ...

    async def send_message(self, user_id: str, message: str) -> dict:
        return {"error": "not implemented"}

    def get_agent_env(self, inbox_dir: str) -> dict:
        return {}
