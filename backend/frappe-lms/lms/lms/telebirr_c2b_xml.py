"""
Pure XML helpers for the telebirr C2B (CPS-Biller) integration.

No Frappe dependency on purpose: these functions parse the inbound CPS SOAP
requests and build the SOAP responses, so they can be unit-tested standalone
against the sample XML without a Frappe site or telebirr connectivity:

    python telebirr_c2b_xml.py

Message contract: Ethio Telecom / Huawei "CPS-Biller ISD v0.2" + the
"Biller Query & Response Sample XML". Namespace:
    http://cps.huawei.com/cpsinterface/c2bpayment

Dispatch is by the SOAP **root element name** (C2BPaymentQueryRequest /
C2BPaymentValidationRequest / C2BPaymentConfirmationRequest), never by
``TransType`` — the samples show TransType is inconsistent ("QueryBill" /
"PayBill" vs numeric 11124 / 12104 / 20032) and is sometimes absent entirely.
"""

import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape as _xml_escape

C2B_NS = "http://cps.huawei.com/cpsinterface/c2bpayment"
SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/"

# Root element (local name) -> logical message type.
REQUEST_TYPES = {
    "C2BPaymentQueryRequest": "query",
    "C2BPaymentValidationRequest": "validation",
    "C2BPaymentConfirmationRequest": "confirmation",
}


class SoapParseError(ValueError):
    """Raised on malformed XML or an unrecognised C2B request."""


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _localname(tag):
    """Strip a '{namespace}' prefix from an ElementTree tag."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def parse_request(xml_text):
    """Parse a CPS C2B SOAP request.

    Returns::

        {
            "msg_type": "query" | "validation" | "confirmation",
            "root":     "<root local element name>",
            "fields":   {"TransID": ..., "BillRefNumber": ..., ...},
            "kyc":      {"FirstName": ..., "MiddleName": ..., "LastName": ...},
        }

    Raises ``SoapParseError`` on empty/malformed input or an unknown request.
    """
    if not xml_text or not xml_text.strip():
        raise SoapParseError("Empty request body")

    # Defensive: refuse DTD/entity payloads (billion-laughs / XXE) outright.
    upper = xml_text.upper()
    if "<!DOCTYPE" in upper or "<!ENTITY" in upper:
        raise SoapParseError("DTD/entity declarations are not allowed")

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise SoapParseError("Malformed XML: {0}".format(exc))

    # Find the C2B request element anywhere under the SOAP envelope.
    req_el = None
    msg_type = None
    for el in root.iter():
        ln = _localname(el.tag)
        if ln in REQUEST_TYPES:
            req_el, msg_type = el, REQUEST_TYPES[ln]
            break
    if req_el is None:
        raise SoapParseError("No recognised C2B request element found")

    fields, kyc = {}, {}
    for child in req_el:
        ln = _localname(child.tag)
        if ln == "KYCInfo":
            name = value = None
            for sub in child:
                sln = _localname(sub.tag)
                if sln == "KYCName":
                    name = (sub.text or "").strip()
                elif sln == "KYCValue":
                    value = (sub.text or "").strip()
            if name:
                kyc[name] = value
        else:
            fields[ln] = (child.text or "").strip()

    return {"msg_type": msg_type, "root": _localname(req_el.tag), "fields": fields, "kyc": kyc}


# ---------------------------------------------------------------------------
# Response building
# ---------------------------------------------------------------------------

def _esc(value):
    return _xml_escape("" if value is None else str(value))


def _envelope(body_inner):
    """Wrap a result element in the SOAP envelope the samples use."""
    return (
        '<soapenv:Envelope xmlns:soapenv="{soap}" xmlns:c2b="{c2b}">'
        "<soapenv:Header/>"
        "<soapenv:Body>{body}</soapenv:Body>"
        "</soapenv:Envelope>"
    ).format(soap=SOAP_NS, c2b=C2B_NS, body=body_inner)


def build_query_result(*, result_code, result_desc, trans_id="", bill_ref="",
                       utility_name="", customer_name="", amount=""):
    """C2BPaymentQueryResult for a *successful* bill lookup (all fields)."""
    inner = (
        "<c2b:C2BPaymentQueryResult>"
        "<ResultCode>{code}</ResultCode>"
        "<ResultDesc>{desc}</ResultDesc>"
        "<TransID>{tid}</TransID>"
        "<BillRefNumber>{bill}</BillRefNumber>"
        "<UtilityName>{util}</UtilityName>"
        "<CustomerName>{cust}</CustomerName>"
        "<Amount>{amt}</Amount>"
        "</c2b:C2BPaymentQueryResult>"
    ).format(code=_esc(result_code), desc=_esc(result_desc), tid=_esc(trans_id),
             bill=_esc(bill_ref), util=_esc(utility_name), cust=_esc(customer_name),
             amt=_esc(amount))
    return _envelope(inner)


def build_query_error(result_code, result_desc, trans_id="", bill_ref=""):
    """C2BPaymentQueryResult for a failed lookup (code + desc, no bill detail)."""
    inner = (
        "<c2b:C2BPaymentQueryResult>"
        "<ResultCode>{code}</ResultCode>"
        "<ResultDesc>{desc}</ResultDesc>"
        "<TransID>{tid}</TransID>"
        "<BillRefNumber>{bill}</BillRefNumber>"
        "</c2b:C2BPaymentQueryResult>"
    ).format(code=_esc(result_code), desc=_esc(result_desc),
             tid=_esc(trans_id), bill=_esc(bill_ref))
    return _envelope(inner)


def build_validation_result(*, result_code, result_desc, third_party_trans_id=""):
    """C2BPaymentValidationResult (ResultCode 0 == authorise the payment)."""
    inner = (
        "<c2b:C2BPaymentValidationResult>"
        "<ResultCode>{code}</ResultCode>"
        "<ResultDesc>{desc}</ResultDesc>"
        "<ThirdPartyTransID>{tp}</ThirdPartyTransID>"
        "</c2b:C2BPaymentValidationResult>"
    ).format(code=_esc(result_code), desc=_esc(result_desc), tp=_esc(third_party_trans_id))
    return _envelope(inner)


def build_confirmation_result(value="0"):
    """C2BPaymentConfirmationResult — free text, only logged by the CPS."""
    return _envelope(
        "<c2b:C2BPaymentConfirmationResult>{val}</c2b:C2BPaymentConfirmationResult>".format(val=_esc(value))
    )


# ---------------------------------------------------------------------------
# Standalone self-test against the official sample XML  (python this file)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Verbatim from "Biller Query & Response Sample XML (2)".
    QUERY_REQ = """<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
 <soapenv:Header/>
 <soapenv:Body>
 <c2b:C2BPaymentQueryRequest xmlns:c2b="http://cps.huawei.com/cpsinterface/c2bpayment">
 <TransType>QueryBill</TransType>
 <TransID>1463892290097934337</TransID>
 <TransTime>20211125182814</TransTime>
 <BusinessShortCode>8294</BusinessShortCode>
 <BillRefNumber>BILL123</BillRefNumber>
 <MSISDN>251911000000</MSISDN>
</c2b:C2BPaymentQueryRequest>
 </soapenv:Body>
</soapenv:Envelope>"""

    VALIDATION_REQ = """<?xml version='1.0' encoding='UTF-8'?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
 <soapenv:Body>
 <c2b:C2BPaymentValidationRequest xmlns:c2b="http://cps.huawei.com/cpsinterface/c2bpayment">
 <TransID>8KP45KLDDW</TransID>
 <TransTime>20211125182823</TransTime>
 <TransAmount>1.00</TransAmount>
 <BusinessShortCode>8294</BusinessShortCode>
 <BillRefNumber>BILL123</BillRefNumber>
 <InvoiceNumber></InvoiceNumber>
 <MSISDN>251911000000</MSISDN>
 <KYCInfo><KYCName>FirstName</KYCName><KYCValue>Debit.FirstName</KYCValue></KYCInfo>
 <KYCInfo><KYCName>MiddleName</KYCName><KYCValue>Debit.MiddleName</KYCValue></KYCInfo>
 <KYCInfo><KYCName>LastName</KYCName><KYCValue>Debit.LastName</KYCValue></KYCInfo>
 </c2b:C2BPaymentValidationRequest>
 </soapenv:Body>
</soapenv:Envelope>"""

    CONFIRMATION_REQ = """<?xml version='1.0' encoding='UTF-8'?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
 <soapenv:Body>
 <c2b:C2BPaymentConfirmationRequest xmlns:c2b="http://cps.huawei.com/cpsinterface/c2bpayment">
 <TransType>12104</TransType>
 <TransID>8KP45KLDDW</TransID>
 <TransTime>20211125182823</TransTime>
 <TransAmount>1.00</TransAmount>
 <BusinessShortCode>8294</BusinessShortCode>
 <BillRefNumber>BILL123</BillRefNumber>
 <MSISDN>251911000000</MSISDN>
 <KYCInfo><KYCName>FirstName</KYCName><KYCValue>Debit.FirstName</KYCValue></KYCInfo>
 </c2b:C2BPaymentConfirmationRequest>
 </soapenv:Body>
</soapenv:Envelope>"""

    def _check_wellformed(xml_text, must_contain):
        ET.fromstring(xml_text)  # raises if not well-formed
        for needle in must_contain:
            assert needle in xml_text, "missing {0!r} in:\n{1}".format(needle, xml_text)

    # --- Query ---
    q = parse_request(QUERY_REQ)
    assert q["msg_type"] == "query", q
    assert q["fields"]["TransID"] == "1463892290097934337", q
    assert q["fields"]["BillRefNumber"] == "BILL123", q
    assert q["fields"]["BusinessShortCode"] == "8294", q
    _check_wellformed(
        build_query_result(result_code="0", result_desc="Success",
                           trans_id=q["fields"]["TransID"], bill_ref="BILL123",
                           utility_name="Delta SPMU Academy",
                           customer_name="Jane Doe", amount="5000.00"),
        ["<ResultCode>0</ResultCode>", "<Amount>5000.00</Amount>",
         "<CustomerName>Jane Doe</CustomerName>", "C2BPaymentQueryResult"],
    )
    _check_wellformed(build_query_error("1", "Bill not found", q["fields"]["TransID"], "BILL123"),
                      ["<ResultCode>1</ResultCode>", "Bill not found"])

    # --- Validation (note: no TransType element in this sample) ---
    v = parse_request(VALIDATION_REQ)
    assert v["msg_type"] == "validation", v
    assert "TransType" not in v["fields"], "validation sample has no TransType"
    assert v["fields"]["TransAmount"] == "1.00", v
    assert v["kyc"]["FirstName"] == "Debit.FirstName", v
    _check_wellformed(
        build_validation_result(result_code="0", result_desc="Success", third_party_trans_id="DS-XYZ"),
        ["<ResultCode>0</ResultCode>", "<ThirdPartyTransID>DS-XYZ</ThirdPartyTransID>"],
    )

    # --- Confirmation (numeric TransType 12104) ---
    c = parse_request(CONFIRMATION_REQ)
    assert c["msg_type"] == "confirmation", c
    assert c["fields"]["TransType"] == "12104", c
    assert c["fields"]["BillRefNumber"] == "BILL123", c
    _check_wellformed(build_confirmation_result("0"),
                      ["<c2b:C2BPaymentConfirmationResult>0</c2b:C2BPaymentConfirmationResult>"])

    # --- Robustness ---
    for bad, why in [("", "empty"), ("<not-soap/>", "unknown root"),
                     ("<a><b>", "malformed"),
                     ("<!DOCTYPE x [<!ENTITY a 'b'>]><x/>", "DTD blocked")]:
        try:
            parse_request(bad)
        except SoapParseError:
            pass
        else:
            raise AssertionError("expected SoapParseError for {0}".format(why))

    # --- XML-injection safety in built responses ---
    evil = 'A & B <script>"x"'
    out = build_query_result(result_code="0", result_desc="ok", customer_name=evil)
    ET.fromstring(out)  # would raise if the name weren't escaped
    assert "<script>" not in out, "customer name not escaped"

    print("ALL telebirr_c2b_xml SELF-TESTS PASSED")
