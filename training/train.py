"""Train a minimal character-level RNN for name generation.

The input file must contain one name per line. The trained parameters are
written to model_parameters.json in this directory.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
from tqdm import tqdm


HIDDEN_SIZE = 128
SEQ_LENGTH = 25
LEARNING_RATE = 1e-1
ITERATIONS = 50_000
SAMPLE_MAX_LENGTH = 30
SAMPLE_COUNT = 5
SEED = 42


def load_names(path: Path) -> list[str]:
    """Read, normalize, and validate names from a one-name-per-line file."""
    names = [
        line.strip().lower()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not names:
        raise ValueError("input file does not contain any names")
    return names


def build_dataset(names: list[str]) -> tuple[str, dict[str, int], dict[int, str]]:
    """Return training text and deterministic vocabulary mappings."""
    data = "\n".join(names) + "\n"
    chars = sorted(set(data))
    char_to_ix = {char: ix for ix, char in enumerate(chars)}
    ix_to_char = {ix: char for char, ix in char_to_ix.items()}
    return data, char_to_ix, ix_to_char


def initialize_parameters(
    hidden_size: int, vocab_size: int, rng: np.random.Generator
) -> dict[str, np.ndarray]:
    """Initialize RNN weights and biases."""
    return {
        "Wxh": rng.normal(0.0, 0.01, (hidden_size, vocab_size)),
        "Whh": rng.normal(0.0, 0.01, (hidden_size, hidden_size)),
        "Why": rng.normal(0.0, 0.01, (vocab_size, hidden_size)),
        "bh": np.zeros((hidden_size, 1)),
        "by": np.zeros((vocab_size, 1)),
    }


def loss_step(
    inputs: list[int],
    targets: list[int],
    hprev: np.ndarray,
    params: dict[str, np.ndarray],
    vocab_size: int,
) -> tuple[float, dict[str, np.ndarray], np.ndarray]:
    """Run one truncated BPTT step and return loss, gradients, and final state."""
    Wxh, Whh, Why = params["Wxh"], params["Whh"], params["Why"]
    bh, by = params["bh"], params["by"]
    xs: dict[int, np.ndarray] = {}
    hs = {-1: np.copy(hprev)}
    ys: dict[int, np.ndarray] = {}
    ps: dict[int, np.ndarray] = {}
    loss = 0.0

    for t, input_ix in enumerate(inputs):
        xs[t] = np.zeros((vocab_size, 1))
        xs[t][input_ix] = 1
        hs[t] = np.tanh(Wxh @ xs[t] + Whh @ hs[t - 1] + bh)
        ys[t] = Why @ hs[t] + by
        exp_y = np.exp(ys[t] - np.max(ys[t]))
        ps[t] = exp_y / np.sum(exp_y)
        loss += -float(np.log(ps[t][targets[t], 0]))

    grads = {name: np.zeros_like(value) for name, value in params.items()}
    dhnext = np.zeros_like(hs[0])

    for t in reversed(range(len(inputs))):
        dy = np.copy(ps[t])
        dy[targets[t]] -= 1
        grads["Why"] += dy @ hs[t].T
        grads["by"] += dy
        dh = Why.T @ dy + dhnext
        dhraw = (1 - hs[t] * hs[t]) * dh
        grads["bh"] += dhraw
        grads["Wxh"] += dhraw @ xs[t].T
        grads["Whh"] += dhraw @ hs[t - 1].T
        dhnext = Whh.T @ dhraw

    for grad in grads.values():
        np.clip(grad, -5, 5, out=grad)
    return loss, grads, hs[len(inputs) - 1]


def sample_name(
    params: dict[str, np.ndarray],
    char_to_ix: dict[str, int],
    ix_to_char: dict[int, str],
    rng: np.random.Generator,
    max_length: int = SAMPLE_MAX_LENGTH,
) -> str:
    """Generate a single name, stopping at the first newline."""
    vocab_size = len(char_to_ix)
    h = np.zeros((params["Whh"].shape[0], 1))
    x = np.zeros((vocab_size, 1))
    x[char_to_ix["\n"]] = 1
    chars: list[str] = []

    for _ in range(max_length):
        h = np.tanh(params["Wxh"] @ x + params["Whh"] @ h + params["bh"])
        y = params["Why"] @ h + params["by"]
        exp_y = np.exp(y - np.max(y))
        p = exp_y / np.sum(exp_y)
        ix = int(rng.choice(vocab_size, p=p.ravel()))
        char = ix_to_char[ix]
        if char == "\n":
            break
        chars.append(char)
        x = np.zeros((vocab_size, 1))
        x[ix] = 1

    return "".join(chars).strip().capitalize() or "(empty)"


def train(
    data: str,
    char_to_ix: dict[str, int],
    *,
    hidden_size: int = HIDDEN_SIZE,
    seq_length: int = SEQ_LENGTH,
    learning_rate: float = LEARNING_RATE,
    iterations: int = ITERATIONS,
    seed: int = SEED,
) -> dict[str, Any]:
    """Train the RNN and return serializable model metadata plus parameters."""
    effective_seq_length = min(seq_length, len(data) - 1)
    if effective_seq_length < 1:
        raise ValueError("training data must contain at least two characters")

    rng = np.random.default_rng(seed)
    vocab_size = len(char_to_ix)
    params = initialize_parameters(hidden_size, vocab_size, rng)
    memory = {name: np.zeros_like(value) for name, value in params.items()}
    hprev = np.zeros((hidden_size, 1))
    smooth_loss = -np.log(1.0 / vocab_size) * effective_seq_length
    p = 0

    with tqdm(total=iterations, desc="training", unit="step") as progress:
        for step in range(iterations):
            if p + effective_seq_length + 1 >= len(data) or step == 0:
                hprev = np.zeros((hidden_size, 1))
                p = 0

            inputs = [char_to_ix[char] for char in data[p : p + effective_seq_length]]
            targets = [
                char_to_ix[char] for char in data[p + 1 : p + effective_seq_length + 1]
            ]
            loss, grads, hprev = loss_step(inputs, targets, hprev, params, vocab_size)
            smooth_loss = smooth_loss * 0.999 + loss * 0.001

            for name, param in params.items():
                memory[name] += grads[name] * grads[name]
                param += -learning_rate * grads[name] / np.sqrt(memory[name] + 1e-8)

            p += effective_seq_length
            progress.set_postfix(loss=f"{loss:.4f}", smooth=f"{smooth_loss:.4f}")
            progress.update(1)

    return {
        **params,
        "vocab_size": vocab_size,
        "hidden_size": hidden_size,
        "seq_length": effective_seq_length,
        "requested_seq_length": seq_length,
        "learning_rate": learning_rate,
        "iterations": iterations,
        "seed": seed,
    }


def to_jsonable(value: Any) -> Any:
    """Convert NumPy values recursively into JSON-native values."""
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        return float(value)
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    return value


def save_model(path: Path, model: dict[str, Any]) -> None:
    """Write model parameters as readable JSON."""
    path.write_text(json.dumps(to_jsonable(model), indent=2), encoding="utf-8")


def print_stats(
    names: list[str],
    data: str,
    vocab_size: int,
    output_path: Path,
    *,
    hidden_size: int,
    seq_length: int,
    learning_rate: float,
    iterations: int,
) -> None:
    """Print the one-time training summary."""
    lengths = [len(name) for name in names]
    print(f"names: {len(names)}")
    print(f"characters: {len(data)}")
    print(f"vocab size: {vocab_size}")
    print(
        "name length: "
        f"min={min(lengths)}, avg={sum(lengths) / len(lengths):.2f}, max={max(lengths)}"
    )
    print(
        "hyperparameters: "
        f"hidden_size={hidden_size}, seq_length={seq_length}, "
        f"learning_rate={learning_rate}, iterations={iterations}"
    )
    print(f"output: {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a minimal character-level RNN on one-name-per-line data."
    )
    parser.add_argument("names_file", type=Path, help="Path to a names file.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    names_path = args.names_file.expanduser()
    output_path = Path(__file__).with_name("model_parameters.json")

    names = load_names(names_path)
    data, char_to_ix, ix_to_char = build_dataset(names)
    print_stats(
        names,
        data,
        len(char_to_ix),
        output_path,
        hidden_size=HIDDEN_SIZE,
        seq_length=SEQ_LENGTH,
        learning_rate=LEARNING_RATE,
        iterations=ITERATIONS,
    )

    model = train(data, char_to_ix)
    model.update(
        {
            "char_to_ix": char_to_ix,
            "ix_to_char": ix_to_char,
            "stats": {
                "names": len(names),
                "characters": len(data),
                "min_name_length": min(len(name) for name in names),
                "avg_name_length": sum(len(name) for name in names) / len(names),
                "max_name_length": max(len(name) for name in names),
            },
        }
    )
    save_model(output_path, model)

    sample_rng = np.random.default_rng(SEED + 1)
    params = {name: model[name] for name in ("Wxh", "Whh", "Why", "bh", "by")}
    print("\nsamples:")
    for _ in range(SAMPLE_COUNT):
        print(f"- {sample_name(params, char_to_ix, ix_to_char, sample_rng)}")


if __name__ == "__main__":
    main()
