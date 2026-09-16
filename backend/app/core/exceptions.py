"""
Custom exception classes for consistent API error responses.
"""
from fastapi import HTTPException, status


class AuctionError(HTTPException):
    def __init__(self, code: str, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail={"code": code, "message": detail})
        self.code = code


class InsufficientPurse(AuctionError):
    def __init__(self, available: float, required: float):
        super().__init__(
            "INSUFFICIENT_PURSE",
            f"Insufficient purse. Available: ₹{available:.0f}, Required: ₹{required:.0f}",
        )


class AuctionNotLive(AuctionError):
    def __init__(self):
        super().__init__("AUCTION_NOT_LIVE", "Auction is not currently live.")


class PlayerNotAvailable(AuctionError):
    def __init__(self):
        super().__init__("PLAYER_NOT_AVAILABLE", "This player is not currently available for bidding.")


class BidTooLow(AuctionError):
    def __init__(self, minimum: float, received: float):
        super().__init__(
            "BID_TOO_LOW",
            f"Bid ₹{received:.0f} is below the minimum required ₹{minimum:.0f}.",
        )


class TeamAlreadyHighestBidder(AuctionError):
    def __init__(self):
        super().__init__("TEAM_ALREADY_HIGHEST", "Your team is already the highest bidder.")


class PlayerAlreadySold(AuctionError):
    def __init__(self):
        super().__init__("PLAYER_ALREADY_SOLD", "This player has already been sold.")


class AuctionPaused(AuctionError):
    def __init__(self):
        super().__init__("AUCTION_PAUSED", "Auction is currently paused.")


class InvalidStateTransition(AuctionError):
    def __init__(self, from_state: str, to_state: str):
        super().__init__(
            "INVALID_STATE_TRANSITION",
            f"Cannot transition auction from {from_state} to {to_state}.",
        )


class Unauthorized(AuctionError):
    def __init__(self, detail: str = "Unauthorized"):
        super().__init__("UNAUTHORIZED", detail, status_code=status.HTTP_403_FORBIDDEN)


class NotFound(AuctionError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            "NOT_FOUND",
            f"{resource} not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class AuctionExpired(AuctionError):
    def __init__(self):
        super().__init__("AUCTION_EXPIRED", "Bidding time has expired for this player.")


class NoBidderForSold(AuctionError):
    def __init__(self):
        super().__init__("NO_BIDDER", "Cannot mark player as sold without any bids.")


class InvalidFileUpload(AuctionError):
    def __init__(self, detail: str = "Invalid file upload."):
        super().__init__("INVALID_FILE", detail)
