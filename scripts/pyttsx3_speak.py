import argparse
import pyttsx3

parser = argparse.ArgumentParser()
parser.add_argument("--text", required=True)
parser.add_argument("--rate", type=float, default=1.0)
args = parser.parse_args()
engine = pyttsx3.init()
engine.setProperty("rate", int(180 * max(0.7, min(1.5, args.rate))))
engine.say(args.text)
engine.runAndWait()
