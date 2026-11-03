from app.ocr.models import ParsedSlip
from app.ocr.parsers.base import SlipParser
from app.ocr.parsers.generic import GenericSlipParser

_parsers: list[SlipParser] = []
_generic_parser = GenericSlipParser()


def register_parser(parser: SlipParser) -> None:
    _parsers.append(parser)


def get_parser(text: str) -> SlipParser:
    for parser in _parsers:
        if parser.can_parse(text):
            return parser
    return _generic_parser


def parse_slip_text(text: str) -> ParsedSlip:
    parser = get_parser(text)
    return parser.parse(text)

