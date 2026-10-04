from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from reasoning.disruption import (
    AssessmentTimeoutError,
    AssessmentUnavailableError,
    DisruptionReasoningService,
)
from schemas.disruption import DisruptionAssessment, DisruptionAssessmentRequest

router = APIRouter(prefix="/analysis", tags=["analysis"])


def get_reasoning_service() -> DisruptionReasoningService:
    return DisruptionReasoningService()


@router.post("/disruption", response_model=DisruptionAssessment)
async def assess_disruption(
    request: DisruptionAssessmentRequest,
    service: Annotated[DisruptionReasoningService, Depends(get_reasoning_service)],
) -> DisruptionAssessment:
    try:
        return await service.assess(request)
    except AssessmentTimeoutError as error:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI assessment timed out",
        ) from error
    except AssessmentUnavailableError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI assessment is unavailable",
        ) from error
