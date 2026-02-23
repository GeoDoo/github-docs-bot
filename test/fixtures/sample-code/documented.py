def calculate_total(items: list[float], tax: float) -> float:
    """Calculate the total price including tax.

    Parameters
    ----------
    items : list[float]
        List of item prices.
    tax : float
        Tax rate as a decimal.

    Returns
    -------
    float
        Total price with tax applied.
    """
    subtotal = sum(items)
    return subtotal * (1 + tax)


class ShoppingCart:
    """A shopping cart that tracks items and computes totals."""

    def __init__(self):
        self.items = []
