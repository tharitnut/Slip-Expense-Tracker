from app.ocr.parsers.base import SlipParser
from app.ocr.parsers.generic import GenericSlipParser
from app.ocr.parsers.registry import get_parser, parse_slip_text, register_parser

__all__ = ["SlipParser", "GenericSlipParser", "get_parser", "parse_slip_text", "register_parser"]

