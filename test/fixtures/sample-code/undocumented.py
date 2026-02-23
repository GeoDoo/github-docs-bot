from dataclasses import dataclass


class ShoppingCart:
    def __init__(self):
        self.items = []

    def add_item(self, item):
        self.items.append(item)

    def get_total(self):
        return sum(item.price * item.quantity for item in self.items)


def calculate_total(items: list[float], tax: float) -> float:
    subtotal = sum(items)
    return subtotal * (1 + tax)


async def fetch_user_profile(user_id: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"/api/users/{user_id}") as response:
            return await response.json()


def _internal_helper():
    print("internal")
