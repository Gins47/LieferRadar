from datetime import datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProviderTimestamp(StrictModel):
    kind: Literal["omitted", "explicit-null", "value"]
    value: datetime | None = None

    @model_validator(mode="after")
    def validate_presence(self) -> "ProviderTimestamp":
        if self.kind == "value":
            if self.value is None or self.value.utcoffset() != timedelta(0):
                raise ValueError("value timestamps must be UTC instants")
        elif self.value is not None:
            raise ValueError("omitted and explicit-null timestamps cannot have a value")
        return self


class ShipmentSummary(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    pickupCity: str = Field(min_length=1, max_length=100)
    destinationCity: str = Field(min_length=1, max_length=100)
    pickupAt: datetime
    plannedDeliveryAt: datetime

    @model_validator(mode="after")
    def validate_times(self) -> "ShipmentSummary":
        if (
            self.pickupAt.utcoffset() != timedelta(0)
            or self.plannedDeliveryAt.utcoffset() != timedelta(0)
        ):
            raise ValueError("shipment timestamps must be UTC instants")
        if self.plannedDeliveryAt <= self.pickupAt:
            raise ValueError("plannedDeliveryAt must be after pickupAt")
        return self


class VehicleSummary(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    simulated: Literal[True]
    simulatedAt: datetime

    @model_validator(mode="after")
    def validate_simulated_at(self) -> "VehicleSummary":
        if self.simulatedAt.utcoffset() != timedelta(0):
            raise ValueError("simulatedAt must be a UTC instant")
        return self


class DisruptionEvidence(StrictModel):
    evidenceId: str = Field(min_length=1, max_length=100)
    source: str = Field(min_length=1, max_length=100)
    providerId: str = Field(min_length=1, max_length=300)
    ingestionMode: Literal["LIVE", "REPLAY"]
    capturedAt: datetime
    queriedRoad: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=500)
    subtitle: str | None = Field(default=None, max_length=500)
    descriptions: list[str] = Field(default_factory=list, max_length=20)
    startTimestamp: ProviderTimestamp
    endTimestamp: ProviderTimestamp
    delayMinutes: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_captured_at(self) -> "DisruptionEvidence":
        if self.capturedAt.utcoffset() != timedelta(0):
            raise ValueError("capturedAt must be a UTC instant")
        return self


class GeographicCheck(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    state: Literal["NEAR_REMAINING_ROUTE", "DISTANT", "UNKNOWN"]
    distanceMetres: float | None = Field(default=None, ge=0)
    toleranceMetres: float | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_distance(self) -> "GeographicCheck":
        if self.state == "UNKNOWN":
            if self.distanceMetres is not None or self.toleranceMetres is not None:
                raise ValueError("unknown geographic checks cannot include distance values")
        elif self.distanceMetres is None or self.toleranceMetres is None:
            raise ValueError("known geographic checks require distance and tolerance")
        return self


class DirectionCheck(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    state: Literal["COMPATIBLE", "CONFLICTING", "UNKNOWN"]


class RoutePositionCheck(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    state: Literal["AHEAD_OR_ALONGSIDE", "BEHIND", "UNKNOWN"]


class TimingCheck(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    state: Literal["POSSIBLE", "CONFLICTING", "UNKNOWN"]


class CandidateChecks(StrictModel):
    geographic: GeographicCheck
    direction: DirectionCheck
    routePosition: RoutePositionCheck
    timing: TimingCheck

    @model_validator(mode="after")
    def reject_definite_exclusions(self) -> "CandidateChecks":
        if self.geographic.state == "DISTANT":
            raise ValueError("NestJS must exclude geographically distant warnings")
        if self.direction.state == "CONFLICTING":
            raise ValueError("NestJS must exclude direction-conflicting warnings")
        if self.routePosition.state == "BEHIND":
            raise ValueError("NestJS must exclude warnings behind the vehicle")
        if self.timing.state == "CONFLICTING":
            raise ValueError("NestJS must exclude timing-conflicting warnings")
        return self


class Limitation(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=1_000)


class DisruptionAssessmentRequest(StrictModel):
    assessmentId: str = Field(min_length=1, max_length=100)
    shipment: ShipmentSummary
    vehicle: VehicleSummary
    disruption: DisruptionEvidence
    checks: CandidateChecks
    limitations: list[Limitation] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_evidence(self) -> "DisruptionAssessmentRequest":
        checks = [
            self.checks.geographic,
            self.checks.direction,
            self.checks.routePosition,
            self.checks.timing,
        ]
        evidence_ids = [self.disruption.evidenceId, *(check.id for check in checks)]
        evidence_ids.extend(limitation.id for limitation in self.limitations)
        if len(evidence_ids) != len(set(evidence_ids)):
            raise ValueError("evidence IDs must be unique")

        return self

    @property
    def evidence_ids(self) -> set[str]:
        return {
            self.disruption.evidenceId,
            self.checks.geographic.id,
            self.checks.direction.id,
            self.checks.routePosition.id,
            self.checks.timing.id,
            *(limitation.id for limitation in self.limitations),
        }


class SupportingEvidence(StrictModel):
    factIds: list[str] = Field(min_length=1, max_length=10)
    explanation: str = Field(
        min_length=1,
        max_length=1_000,
        description="English explanation grounded in the referenced evidence IDs.",
    )


class RecommendedAction(StrictModel):
    action: Literal["MONITOR", "VERIFY_INFORMATION", "REVIEW_PLAN"]
    rationale: str = Field(
        min_length=1,
        max_length=1_000,
        description="English rationale for a human-review action.",
    )
    requiresHumanReview: Literal[True]


class LlmDisruptionReasoning(StrictModel):
    operatorMessage: str = Field(
        min_length=1,
        max_length=2_000,
        description="Concise English message for the operator.",
    )
    supportingEvidence: list[SupportingEvidence] = Field(min_length=1, max_length=20)
    missingEvidence: list[str] = Field(
        max_length=20,
        description="English statements of missing evidence.",
    )
    uncertainty: list[str] = Field(
        max_length=20,
        description="English statements of uncertainty.",
    )
    possibleConsequences: list[str] = Field(
        max_length=10,
        description="English statements of possible, not confirmed, consequences.",
    )
    recommendedActions: list[RecommendedAction] = Field(min_length=1, max_length=5)


class DisruptionAssessment(LlmDisruptionReasoning):
    assessmentId: str = Field(min_length=1, max_length=100)
