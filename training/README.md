# Name Generator Training

This folder contains a minimal character-level RNN trainer for name generation.
The training data must be a UTF-8 text file with one name per line.

## Train on New Data

From the project root, run:

```bash
python training/train.py path/to/names.txt
```

The script prints initial dataset statistics, then shows training progress with
`tqdm`. When training finishes it writes:

```text
training/model_parameters.json
```

It also prints 5 generated sample names so you can quickly inspect the result.

## Input Format

Use plain text with one name per line:

```text
Anna
Beth
Clara
```

Blank lines are ignored. Names are lowercased before training.

## Requirements

Install the Python dependencies if they are not already available:

```bash
pip install -r training/requirements.txt
```

If you do not want to install packages globally, create a local virtual
environment first.

On macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r training/requirements.txt
```

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r training/requirements.txt
```

## Notes

The trainer uses fixed hyperparameters in `train.py` to keep the command simple:

- hidden size: 128
- sequence length: 25
- learning rate: 0.1
- iterations: 50000

Re-running training overwrites `training/model_parameters.json`.
