# Character-Level RNN Playground

Educational home project for learning how character-level recurrent neural
networks work in practice.

Live demo: <https://char-level-rnn-playground.vercel.app/>

## What It Does

The app demonstrates a small name generator built from a character-level RNN.
As a practical example, it generates orc-style names for game or story
characters from trained model parameters embedded directly in the web page.

All generation is implemented with plain vanilla computations in JavaScript.
No machine-learning framework is used at runtime.

## Why This Project Exists

This project is meant as a compact example of how to:

- train a character-level RNN on a custom names dataset
- export the trained model parameters
- embed those parameters into a simple web app
- generate new names one character at a time

It can be used as a reference for building a custom RNN-based name generator
for other fictional races, settings, products, or datasets.

## Training

The training code lives in [`training`](./training). See
[`training/README.md`](./training/README.md) for setup instructions, input data
format, and how to train a new model.

## Running Locally

Install the web app dependencies and start the development server:

```bash
npm install
npm run dev
```

Then open the local URL printed by the dev server.
