from app.models.forecast import CongestionLevel


def classify_congestion(predicted: float, capacity: float | None) -> CongestionLevel:
    if capacity is None or capacity <= 0:
        return CongestionLevel.low
    ratio = predicted / capacity
    if ratio < 0.6:
        return CongestionLevel.low
    elif ratio < 0.8:
        return CongestionLevel.moderate
    elif ratio < 1.0:
        return CongestionLevel.high
    return CongestionLevel.critical


def classify_congestion_by_percentile(predicted: float, p50: float, p95: float) -> CongestionLevel:
    if predicted < p50 * 0.8:
        return CongestionLevel.low
    elif predicted < p50 * 1.1:
        return CongestionLevel.moderate
    elif predicted < p95:
        return CongestionLevel.high
    return CongestionLevel.critical
