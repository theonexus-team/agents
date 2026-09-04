"""Line-for-line port of src/lib/positionSizing.ts computeScaledContracts. Not used by
default in backtests (see engine/runner.py + README — backtests default to fixed
contracts per run since the scaled ladder is inherently path-dependent on the whole
account's cross-strategy equity curve, not just one isolated strategy's). Kept here,
verbatim, for the opt-in sizing_mode="scaled_ladder" case."""

BASELINE_CONTRACTS = 4
MAX_MICRO_CONTRACTS = 40


def compute_scaled_contracts(drawdown_from_peak: float, profit_from_start: float, max_loss_from_peak: float) -> int:
    dd_fraction = (drawdown_from_peak / max_loss_from_peak) if max_loss_from_peak > 0 else 0

    if dd_fraction >= 0.75:
        return 1
    if dd_fraction >= 0.5:
        return 2
    if dd_fraction >= 0.25:
        return 3

    if profit_from_start < 0.25 * max_loss_from_peak:
        return BASELINE_CONTRACTS
    if profit_from_start < 0.75 * max_loss_from_peak:
        return BASELINE_CONTRACTS + 1

    steps_beyond = int((profit_from_start - 0.75 * max_loss_from_peak) // (0.5 * max_loss_from_peak))
    return min(MAX_MICRO_CONTRACTS, BASELINE_CONTRACTS + 2 + steps_beyond)
