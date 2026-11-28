"""Pure-Python academic report generation service for CCE-PGPA.
Generates genuine OpenXML (.xlsx) multi-sheet workbooks and RFC 32000-1
compliant PDF documents without external C/Pyodide dependencies.
"""

import io
import re
import zipfile
import xml.sax.saxutils as saxutils
from datetime import datetime
from typing import Any, Dict, List, Optional


def _col_idx_to_name(col_idx: int) -> str:
    """Convert 1-based column index to Excel column name (1->A, 27->AA)."""
    name = ""
    while col_idx > 0:
        col_idx, rem = divmod(col_idx - 1, 26)
        name = chr(65 + rem) + name
    return name or "A"


def generate_excel_report(
    title: str,
    sheets: List[Dict[str, Any]],
) -> bytes:
    """Generate a genuine Microsoft Excel (.xlsx) OpenXML workbook.

    Compatible with Microsoft Excel 2007+, Microsoft 365, WPS Office,
    Google Sheets, LibreOffice, and Apple Numbers.

    sheets format:
    [
        {
            "name": "Summary",
            "headers": ["Reg No", "Student Name", "Section", "Total Points", "Grade"],
            "rows": [["2127210801001", "John Doe", "A", 450, "O"], ...]
        },
        ...
    ]
    """
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    clean_title = re.sub(r'[\r\n\t]+', ' ', str(title or "CCE-PGPA Academic Report")).strip()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. [Content_Types].xml
        ct_parts = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '  <Default Extension="xml" ContentType="application/xml"/>',
            '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
            '  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        ]
        for idx in range(1, len(sheets) + 1):
            ct_parts.append(
                f'  <Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            )
        ct_parts.append("</Types>")
        zf.writestr("[Content_Types].xml", "\n".join(ct_parts))

        # 2. _rels/.rels
        zf.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n'
            "</Relationships>",
        )

        # 3. xl/_rels/workbook.xml.rels
        wb_rels_parts = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ]
        for idx in range(1, len(sheets) + 1):
            wb_rels_parts.append(
                f'  <Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>'
            )
        styles_rid = f"rId{len(sheets) + 1}"
        wb_rels_parts.append(
            f'  <Relationship Id="{styles_rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        )
        wb_rels_parts.append("</Relationships>")
        zf.writestr("xl/_rels/workbook.xml.rels", "\n".join(wb_rels_parts))

        # 4. xl/workbook.xml
        wb_parts = [
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            "  <sheets>",
        ]
        for idx, sheet in enumerate(sheets, start=1):
            raw_sname = str(sheet.get("name") or f"Sheet{idx}")
            clean_sname = re.sub(r'[:\\/?*\[\]]', ' ', raw_sname).strip()[:31] or f"Sheet{idx}"
            esc_sname = saxutils.escape(clean_sname)
            wb_parts.append(f'    <sheet name="{esc_sname}" sheetId="{idx}" r:id="rId{idx}"/>')
        wb_parts.append("  </sheets>")
        wb_parts.append("</workbook>")
        zf.writestr("xl/workbook.xml", "\n".join(wb_parts))

        # 5. xl/styles.xml
        styles_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n'
            '  <fonts count="3">\n'
            '    <font><name val="Calibri"/><sz val="11"/><color rgb="FF1E2A33"/></font>\n'
            '    <font><b/><name val="Calibri"/><sz val="11"/><color rgb="FFFFFFFF"/></font>\n'
            '    <font><b/><name val="Calibri"/><sz val="13"/><color rgb="FF1E2A33"/></font>\n'
            '  </fonts>\n'
            '  <fills count="5">\n'
            '    <fill><patternFill patternType="none"/></fill>\n'
            '    <fill><patternFill patternType="gray125"/></fill>\n'
            '    <fill><patternFill patternType="solid"><fgColor rgb="FFFFB347"/></patternFill></fill>\n'
            '    <fill><patternFill patternType="solid"><fgColor rgb="FF1E2A33"/></patternFill></fill>\n'
            '    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F7"/></patternFill></fill>\n'
            '  </fills>\n'
            '  <borders count="2">\n'
            '    <border><left/><right/><top/><bottom/></border>\n'
            '    <border>\n'
            '      <left style="thin"><color rgb="FFC9D3DC"/></left>\n'
            '      <right style="thin"><color rgb="FFC9D3DC"/></right>\n'
            '      <top style="thin"><color rgb="FFC9D3DC"/></top>\n'
            '      <bottom style="thin"><color rgb="FFC9D3DC"/></bottom>\n'
            '    </border>\n'
            '  </borders>\n'
            '  <cellStyleXfs count="1">\n'
            '    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>\n'
            '  </cellStyleXfs>\n'
            '  <cellXfs count="5">\n'
            '    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>\n'
            '    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>\n'
            '    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>\n'
            '    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>\n'
            '    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>\n'
            '  </cellXfs>\n'
            "</styleSheet>"
        )
        zf.writestr("xl/styles.xml", styles_xml)

        # 6. Worksheets
        for sheet_idx, sheet in enumerate(sheets, start=1):
            headers = sheet.get("headers") or []
            rows = sheet.get("rows") or []
            sheet_title = sheet.get("name") or f"Sheet{sheet_idx}"

            ws_parts = [
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
            ]

            # Column widths
            if headers:
                ws_parts.append("  <cols>")
                for col_i in range(1, len(headers) + 1):
                    ws_parts.append(f'    <col min="{col_i}" max="{col_i}" width="18" customWidth="1"/>')
                ws_parts.append("  </cols>")

            ws_parts.append("  <sheetData>")

            # Row 1: Title Banner
            ws_parts.append('    <row r="1" ht="26" customHeight="1">')
            ws_parts.append(
                f'      <c r="A1" t="inlineStr" s="1"><is><t>{saxutils.escape(clean_title)}</t></is></c>'
            )
            ws_parts.append("    </row>")

            # Row 2: Empty Spacer
            ws_parts.append('    <row r="2" ht="8" customHeight="1"/>')

            # Row 3: Header Row
            if headers:
                ws_parts.append('    <row r="3" ht="22" customHeight="1">')
                for c_idx, h in enumerate(headers, start=1):
                    ref = f"{_col_idx_to_name(c_idx)}3"
                    ws_parts.append(
                        f'      <c r="{ref}" t="inlineStr" s="2"><is><t>{saxutils.escape(str(h))}</t></is></c>'
                    )
                ws_parts.append("    </row>")

            # Data Rows (starting from row 4)
            for r_offset, row_data in enumerate(rows, start=4):
                is_alt = (r_offset % 2 == 1)
                row_style = "3" if is_alt else "4"
                ws_parts.append(f'    <row r="{r_offset}" ht="20" customHeight="1">')
                for c_idx, cell_val in enumerate(row_data, start=1):
                    ref = f"{_col_idx_to_name(c_idx)}{r_offset}"
                    if cell_val is None:
                        ws_parts.append(
                            f'      <c r="{ref}" t="inlineStr" s="{row_style}"><is><t>-</t></is></c>'
                        )
                    elif isinstance(cell_val, (int, float)):
                        ws_parts.append(
                            f'      <c r="{ref}" t="n" s="{row_style}"><v>{cell_val}</v></c>'
                        )
                    else:
                        str_val = str(cell_val).strip()
                        # Formula injection prevention
                        if str_val.startswith(("=", "+", "-", "@")) and len(str_val) > 1 and str_val[1:2].isalpha():
                            str_val = "'" + str_val
                        ws_parts.append(
                            f'      <c r="{ref}" t="inlineStr" s="{row_style}"><is><t>{saxutils.escape(str_val)}</t></is></c>'
                        )
                ws_parts.append("    </row>")

            ws_parts.append("  </sheetData>")
            ws_parts.append("</worksheet>")

            zf.writestr(f"xl/worksheets/sheet{sheet_idx}.xml", "\n".join(ws_parts))

    return buf.getvalue()


def _sanitize_pdf_text(text: Any) -> str:
    """Safely sanitize and escape text for PDF literal strings (pure ASCII/WinAnsi)."""
    if text is None:
        return "-"
    s = str(text)

    # Standard Unicode punctuation replacements
    replacements = {
        "\u2014": " - ",  # em-dash
        "\u2013": " - ",  # en-dash
        "\u2018": "'",    # left single quote
        "\u2019": "'",    # right single quote
        "\u201c": '"',    # left double quote
        "\u201d": '"',    # right double quote
        "\u2022": "*",    # bullet
        "\u2026": "...",  # ellipsis
        "\u00a0": " ",    # non-breaking space
        "—": " - ",
        "–": " - ",
        "•": "*",
        "…": "...",
        "★": "*",
        "⚠️": "!",
        "&bull;": "*",
    }
    for orig, repl in replacements.items():
        s = s.replace(orig, repl)

    # Coerce to ASCII with clean replacements so encode("ascii") is 100% safe
    s = s.encode("ascii", "replace").decode("ascii")

    # Escape PDF parentheses and backslashes
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def generate_pdf_report(
    title: str,
    subtitle: str,
    metadata: Dict[str, str],
    headers: Optional[List[str]] = None,
    rows: Optional[List[List[Any]]] = None,
    sections: Optional[List[Dict[str, Any]]] = None,
) -> bytes:
    """Generate a clean, printable PDF document adhering strictly to RFC 32000-1.

    Features header banners, metadata card, table grid, pagination across single or multiple
    sections (with repeated headers on page breaks), and 100% ASCII stream encoding.
    """
    page_width = 842   # A4 Landscape width in points
    page_height = 595  # A4 Landscape height in points
    margin = 35
    content_width = page_width - (2 * margin)

    now_str = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")

    sec_list: List[Dict[str, Any]] = []
    if sections:
        sec_list = sections
    else:
        sec_list = [{
            "title": title,
            "subtitle": subtitle,
            "headers": headers or [],
            "rows": rows or [],
        }]

    # Pre-paginate each section (16 rows per page)
    rows_per_page = 16
    sec_pages_map: List[Tuple[Dict[str, Any], List[List[List[Any]]]]] = []
    total_pages = 0
    for sec in sec_list:
        s_rows = sec.get("rows") or []
        p_list: List[List[List[Any]]] = []
        if not s_rows:
            p_list = [[]]
        else:
            for i in range(0, len(s_rows), rows_per_page):
                p_list.append(s_rows[i : i + rows_per_page])
        sec_pages_map.append((sec, p_list))
        total_pages += len(p_list)

    if total_pages == 0:
        total_pages = 1

    font_helvetica = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    font_bold = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"

    page_contents: List[bytes] = []
    global_page_idx = 0

    for sec, p_list in sec_pages_map:
        sec_title = sec.get("title") or title
        sec_subtitle = sec.get("subtitle") or subtitle
        sec_headers = sec.get("headers") or []
        num_cols = max(len(sec_headers), 1)

        # Dynamic column sizing for varied tables
        col_widths: List[float] = []
        if sec.get("col_widths") and len(sec.get("col_widths")) == num_cols:
            col_widths = [float(w) for w in sec["col_widths"]]
        elif num_cols > 12:
            # 18-col Clubs & Cells: Reg No (75), Name (105), Total (45), Grade (35), 14 cats (36.5 ea)
            fixed_w = 75.0 + 105.0 + 45.0 + 35.0
            rem_col_w = max(24.0, (content_width - fixed_w) / max(1, num_cols - 4))
            col_widths = [75.0, 105.0] + [rem_col_w] * (num_cols - 4) + [45.0, 35.0]
        elif num_cols > 8:
            # 9-col General / 10-col NPTEL
            fixed_w = 85.0 + 115.0 + 50.0 + 40.0
            rem_col_w = max(40.0, (content_width - fixed_w) / max(1, num_cols - 4))
            col_widths = [85.0, 115.0] + [rem_col_w] * (num_cols - 4) + [50.0, 40.0]
        else:
            default_cw = content_width / num_cols
            col_widths = [default_cw] * num_cols

        # Adjust header/cell font sizes and limits to prevent clipping
        if num_cols > 14:
            hdr_font_size = "6.5"
            cell_font_size = "6.5"
            hdr_char_limit = 18
            cell_char_limit = 14
        elif num_cols > 9:
            hdr_font_size = "7.5"
            cell_font_size = "7.5"
            hdr_char_limit = 22
            cell_char_limit = 20
        else:
            hdr_font_size = "8.5"
            cell_font_size = "8.5"
            hdr_char_limit = 24
            cell_char_limit = 24

        col_x_offsets: List[float] = []
        curr_x = margin
        for cw in col_widths:
            col_x_offsets.append(curr_x)
            curr_x += cw

        for p_idx, page_rows in enumerate(p_list):
            global_page_idx += 1
            stream_lines: List[str] = []

            # 1. Header Banner Background (Deep Charcoal #1E2A33)
            stream_lines.append("0.117 0.165 0.200 rg")
            stream_lines.append(f"{margin} {page_height - margin - 45} {content_width} 45 re f")

            # Amber accent stripe (#FFB347)
            stream_lines.append("1.000 0.702 0.278 rg")
            stream_lines.append(f"{margin} {page_height - margin - 48} {content_width} 3 re f")

            # Header Title Text (White)
            stream_lines.append("BT")
            stream_lines.append("/F2 13 Tf")
            stream_lines.append("1.0 1.0 1.0 rg")
            stream_lines.append(f"{margin + 12} {page_height - margin - 22} Td")
            stream_lines.append(f"({_sanitize_pdf_text(sec_title)}) Tj")
            stream_lines.append("ET")

            # Subtitle
            stream_lines.append("BT")
            stream_lines.append("/F1 9 Tf")
            stream_lines.append("0.85 0.90 0.95 rg")
            stream_lines.append(f"{margin + 12} {page_height - margin - 36} Td")
            stream_lines.append(f"({_sanitize_pdf_text(sec_subtitle)}) Tj")
            stream_lines.append("ET")

            # Metadata Card below banner
            meta_y = page_height - margin - 68
            meta_items = [f"{k}: {v}" for k, v in metadata.items()]
            meta_items.append(f"Generated: {now_str}")
            meta_text = "  |  ".join(meta_items)

            stream_lines.append("BT")
            stream_lines.append("/F2 8 Tf")
            stream_lines.append("0.35 0.40 0.45 rg")
            stream_lines.append(f"{margin + 4} {meta_y} Td")
            stream_lines.append(f"({_sanitize_pdf_text(meta_text)}) Tj")
            stream_lines.append("ET")

            # Table Top Y
            table_top_y = meta_y - 16
            row_height = 22

            # Header Row Background (#F2F5F7)
            stream_lines.append("0.949 0.961 0.969 rg")
            stream_lines.append(f"{margin} {table_top_y - row_height} {content_width} {row_height} re f")

            # Header Top & Bottom borders
            stream_lines.append("0.788 0.827 0.863 RG")
            stream_lines.append("1 w")
            stream_lines.append(f"{margin} {table_top_y} m {margin + content_width} {table_top_y} l S")
            stream_lines.append(f"{margin} {table_top_y - row_height} m {margin + content_width} {table_top_y - row_height} l S")

            # Header Columns Text
            for col_idx, h in enumerate(sec_headers):
                if col_idx >= len(col_x_offsets):
                    break
                cx = col_x_offsets[col_idx] + 3
                cy = table_top_y - 15
                stream_lines.append("BT")
                stream_lines.append(f"/F2 {hdr_font_size} Tf")
                stream_lines.append("0.117 0.165 0.200 rg")
                stream_lines.append(f"{cx} {cy} Td")
                stream_lines.append(f"({_sanitize_pdf_text(str(h)[:hdr_char_limit])}) Tj")
                stream_lines.append("ET")

            # Data Rows
            current_y = table_top_y - row_height
            for r_idx, row in enumerate(page_rows):
                current_y -= row_height

                # Alternating row background
                if r_idx % 2 == 1:
                    stream_lines.append("0.980 0.985 0.990 rg")
                    stream_lines.append(f"{margin} {current_y} {content_width} {row_height} re f")

                # Bottom cell border
                stream_lines.append("0.90 0.92 0.94 RG")
                stream_lines.append("0.5 w")
                stream_lines.append(f"{margin} {current_y} m {margin + content_width} {current_y} l S")

                # Cell values
                for col_idx, cell in enumerate(row):
                    if col_idx >= len(sec_headers) or col_idx >= len(col_x_offsets):
                        break
                    cx = col_x_offsets[col_idx] + 3
                    cy = current_y + 6
                    val_str = "-" if cell is None else str(cell)
                    stream_lines.append("BT")
                    stream_lines.append(f"/F1 {cell_font_size} Tf")
                    stream_lines.append("0.12 0.16 0.20 rg")
                    stream_lines.append(f"{cx} {cy} Td")
                    stream_lines.append(f"({_sanitize_pdf_text(val_str[:cell_char_limit])}) Tj")
                    stream_lines.append("ET")

            # Empty state message if no rows on page 1
            if not page_rows and p_idx == 0:
                stream_lines.append("BT")
                stream_lines.append("/F1 10 Tf")
                stream_lines.append("0.5 0.5 0.5 rg")
                stream_lines.append(f"{margin + (content_width / 2) - 80} {table_top_y - 40} Td")
                stream_lines.append("(No records recorded for this section.) Tj")
                stream_lines.append("ET")

            # Footer
            footer_y = margin - 15
            stream_lines.append("0.788 0.827 0.863 RG")
            stream_lines.append("0.5 w")
            stream_lines.append(f"{margin} {footer_y + 12} m {margin + content_width} {footer_y + 12} l S")

            stream_lines.append("BT")
            stream_lines.append("/F1 8 Tf")
            stream_lines.append("0.5 0.5 0.5 rg")
            stream_lines.append(f"{margin} {footer_y} Td")
            stream_lines.append(f"({_sanitize_pdf_text('Sri Sairam Engineering College - CCE Department PGPA System - Confidential')}) Tj")
            stream_lines.append("ET")

            stream_lines.append("BT")
            stream_lines.append("/F1 8 Tf")
            stream_lines.append("0.5 0.5 0.5 rg")
            stream_lines.append(f"{margin + content_width - 80} {footer_y} Td")
            stream_lines.append(f"(Page {global_page_idx} of {total_pages}) Tj")
            stream_lines.append("ET")

            # Pure ASCII stream data guarantees zero UnicodeEncodeError
            stream_data = "\n".join(stream_lines).encode("ascii")
            page_contents.append(stream_data)

    # Assemble PDF structures
    pdf_objs: Dict[int, bytes] = {}
    pdf_objs[3] = font_helvetica
    pdf_objs[4] = font_bold

    current_obj_id = 5
    page_ids: List[int] = []

    for page_bytes in page_contents:
        content_id = current_obj_id
        current_obj_id += 1
        page_id = current_obj_id
        current_obj_id += 1

        page_ids.append(page_id)

        stream_obj = (
            f"<< /Length {len(page_bytes)} >>\nstream\n".encode("ascii")
            + page_bytes
            + b"\nendstream"
        )
        pdf_objs[content_id] = stream_obj

        page_dict = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        ).encode("ascii")
        pdf_objs[page_id] = page_dict

    # Pages object (id=2)
    kids_str = " ".join([f"{pid} 0 R" for pid in page_ids])
    pages_obj = f"<< /Type /Pages /Kids [{kids_str}] /Count {len(page_ids)} >>".encode("ascii")
    pdf_objs[2] = pages_obj

    # Catalog object (id=1)
    catalog_obj = b"<< /Type /Catalog /Pages 2 0 R >>"
    pdf_objs[1] = catalog_obj

    # Build PDF buffer with XRef table
    output = bytearray()
    output.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    xref_offsets: Dict[int, int] = {}
    max_id = max(pdf_objs.keys())

    for obj_id in range(1, max_id + 1):
        if obj_id in pdf_objs:
            xref_offsets[obj_id] = len(output)
            output.extend(f"{obj_id} 0 obj\n".encode("ascii"))
            output.extend(pdf_objs[obj_id])
            output.extend(b"\nendobj\n")

    xref_start = len(output)
    # Exactly 20 bytes per xref entry as required by PDF standard ISO 32000-1
    output.extend(f"xref\n0 {max_id + 1}\n0000000000 65535 f \r\n".encode("ascii"))
    for obj_id in range(1, max_id + 1):
        offset = xref_offsets.get(obj_id, 0)
        output.extend(f"{offset:010d} 00000 n \r\n".encode("ascii"))

    trailer = (
        f"trailer\n<< /Size {max_id + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_start}\n%%EOF\n"
    ).encode("ascii")
    output.extend(trailer)

    return bytes(output)
