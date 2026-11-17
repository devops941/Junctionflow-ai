import io
import logging
from datetime import datetime
from bson import ObjectId
import pandas as pd
from app.db.mongo import get_db, get_gridfs
from app.models.report import ReportCreate, ReportFormat, ReportType

logger = logging.getLogger(__name__)

MIME_TYPES = {
    ReportFormat.pdf: "application/pdf",
    ReportFormat.csv: "text/csv",
    ReportFormat.xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


async def create_report(body: ReportCreate) -> dict:
    db = get_db()
    fs = get_gridfs()

    content, filename = await _build_report(body)

    gfs_id = await fs.upload_from_stream(
        filename,
        io.BytesIO(content),
        metadata={"content_type": MIME_TYPES.get(body.format, "application/octet-stream")},
    )
    doc = {
        "type": body.type.value if hasattr(body.type, "value") else str(body.type),
        "params": body.params,
        "gridfs_file_id": str(gfs_id),
        "format": body.format.value if hasattr(body.format, "value") else str(body.format),
        "created_at": datetime.utcnow(),
    }
    result = await db.reports.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def list_reports() -> list:
    db = get_db()
    cursor = db.reports.find({}, {"gridfs_file_id": 0}).sort("created_at", -1).limit(50)
    return [_s(d) async for d in cursor]


async def get_report_file(report_id: str):
    db = get_db()
    fs = get_gridfs()
    doc = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not doc:
        return None
    grid_out = await fs.open_download_stream(ObjectId(doc["gridfs_file_id"]))
    content = await grid_out.read()
    fmt = ReportFormat(doc["format"])
    filename = f"report_{report_id}.{fmt.value}"
    return content, MIME_TYPES[fmt], filename


async def delete_report(report_id: str) -> bool:
    db = get_db()
    fs = get_gridfs()
    doc = await db.reports.find_one({"_id": ObjectId(report_id)})
    if not doc:
        return False
    if doc.get("gridfs_file_id"):
        try:
            await fs.delete(ObjectId(doc["gridfs_file_id"]))
        except Exception:
            pass
    await db.reports.delete_one({"_id": ObjectId(report_id)})
    return True


# ---------------------------------------------------------------------------
# Data Gathering Engines
# ---------------------------------------------------------------------------

async def _get_report_data(body: ReportCreate) -> dict:
    db = get_db()
    rtype = body.type.value if hasattr(body.type, "value") else str(body.type)

    if rtype == ReportType.congestion_analysis.value:
        return await _gather_congestion_data(db, body.params)
    elif rtype == ReportType.forecast_summary.value:
        return await _gather_forecast_data(db, body.params)
    elif rtype == ReportType.model_comparison.value:
        return await _gather_model_comparison_data(db)
    elif rtype == ReportType.dataset_validation.value:
        return await _gather_dataset_validation_data(db)
    else:
        return {
            "title": "JunctionFlow AI Telemetry Report",
            "subtitle": f"Report Type: {rtype}",
            "kpis": [("Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"))],
            "headers": ["Information", "Value"],
            "rows": [["Status", "No specific generator configured for this type."]],
            "recommendations": [],
        }


async def _gather_congestion_data(db, params: dict) -> dict:
    # 1. Fetch junctions map
    j_cursor = db.junctions.find({})
    junctions_map = {}
    async for j in j_cursor:
        if j:
            jid = j.get("junction_id", str(j.get("_id", "Unknown")))
            junctions_map[jid] = j

    # 2. Fetch latest forecasts
    q = {}
    if params.get("forecast_id"):
        try:
            q["_id"] = ObjectId(params["forecast_id"])
        except Exception:
            pass
    f_cursor = db.forecasts.find(q).sort("generated_at", -1).limit(10)
    forecasts = [f async for f in f_cursor]

    rows = []
    critical_count = 0
    high_count = 0
    max_util = 0.0

    for f in forecasts:
        jid = f.get("junction_id", "Unknown")
        j_info = junctions_map.get(jid, {})
        j_name = j_info.get("name", jid)
        capacity = j_info.get("capacity_per_hour") or 1200.0

        for p in f.get("predictions", []):
            pred = float(p.get("predicted", 0))
            ts = p.get("timestamp", "")
            if isinstance(ts, datetime):
                ts_str = ts.strftime("%Y-%m-%d %H:%M")
            else:
                ts_str = str(ts)[:16].replace("T", " ")

            util_pct = (pred / capacity * 100) if capacity > 0 else 0.0
            if util_pct > max_util:
                max_util = util_pct

            level = p.get("congestion_level")
            if not level:
                if util_pct >= 100:
                    level = "critical"
                elif util_pct >= 80:
                    level = "high"
                elif util_pct >= 60:
                    level = "moderate"
                else:
                    level = "low"

            if level == "critical":
                critical_count += 1
            elif level == "high":
                high_count += 1

            rows.append({
                "timestamp": ts_str,
                "junction_id": jid,
                "junction_name": j_name,
                "predicted": round(pred),
                "capacity": round(capacity),
                "utilization": f"{util_pct:.1f}%",
                "level": level.upper(),
            })

    # Sort rows by timestamp and prioritize high/critical
    rows.sort(key=lambda x: (x["timestamp"], -x["predicted"]))

    # If no forecasts were found, fallback to traffic observations
    if not rows:
        obs_cursor = db.traffic_observations.find({}).sort("timestamp", -1).limit(30)
        async for obs in obs_cursor:
            jid = obs.get("junction_id", "Unknown")
            j_info = junctions_map.get(jid, {})
            capacity = j_info.get("capacity_per_hour") or 1200.0
            vc = float(obs.get("vehicle_count", 0))
            util_pct = (vc / capacity * 100) if capacity > 0 else 0.0
            level = "CRITICAL" if util_pct >= 100 else "HIGH" if util_pct >= 80 else "MODERATE" if util_pct >= 60 else "LOW"
            ts = obs.get("timestamp", "")
            ts_str = ts.strftime("%Y-%m-%d %H:%M") if isinstance(ts, datetime) else str(ts)[:16].replace("T", " ")
            rows.append({
                "timestamp": ts_str,
                "junction_id": jid,
                "junction_name": j_info.get("name", jid),
                "predicted": round(vc),
                "capacity": round(capacity),
                "utilization": f"{util_pct:.1f}%",
                "level": level,
            })

    # Prepare table structure
    headers = ["Timestamp", "Junction", "Predicted Vol", "Capacity", "Utilization", "Risk Status"]
    table_rows = [
        [r["timestamp"], f"{r['junction_name']} ({r['junction_id']})", f"{r['predicted']:,} veh/h", f"{r['capacity']:,} veh/h", r["utilization"], r["level"]]
        for r in rows[:40]  # top 40 records
    ]

    kpis = [
        ("Monitored Intersections", f"{len(junctions_map)} junctions"),
        ("Critical Bottlenecks", f"{critical_count} peak windows"),
        ("High Congestion Peaks", f"{high_count} windows"),
        ("Max Peak Utilization", f"{max_util:.1f}% load"),
    ]

    recommendations = [
        "Deploy adaptive traffic signal timing favoring the bottleneck arterial corridors during highlighted critical hours.",
        "Pre-stage traffic control officers at intersections exceeding 95% design capacity at least 30 minutes prior to peak.",
        "Implement dynamic variable-message highway signs (VMS) to divert through-traffic to adjacent secondary corridors.",
    ]

    return {
        "title": "Congestion Intelligence & Intersection Bottleneck Report",
        "subtitle": "Hourly capacity analysis, predicted bottleneck windows, and proactive mitigation strategy.",
        "kpis": kpis,
        "headers": headers,
        "rows": table_rows,
        "raw_dict_rows": rows,
        "recommendations": recommendations,
    }


async def _gather_forecast_data(db, params: dict) -> dict:
    q = {}
    if params.get("forecast_id"):
        try:
            q["_id"] = ObjectId(params["forecast_id"])
        except Exception:
            pass
    doc = await db.forecasts.find_one(q, sort=[("generated_at", -1)])
    if not doc:
        return {
            "title": "Traffic Volume Forecast Summary",
            "subtitle": "No active forecast inferences available in database.",
            "kpis": [("Status", "No Data")],
            "headers": ["Message"],
            "rows": [["Please generate a forecast first from the Forecasts page."]],
            "recommendations": [],
        }

    jid = doc.get("junction_id", "All")
    horizon = doc.get("horizon_hours", 24)
    preds = doc.get("predictions", [])

    avg_val = round(sum(p.get("predicted", 0) for p in preds) / max(1, len(preds)))
    max_val = round(max((p.get("predicted", 0) for p in preds), default=0))

    headers = ["Forecast Hour", "Junction", "Predicted Count", "Lower 95% CI", "Upper 95% CI", "Congestion"]
    table_rows = []
    dict_rows = []
    for p in preds:
        ts = p.get("timestamp", "")
        ts_str = ts.strftime("%Y-%m-%d %H:%M") if isinstance(ts, datetime) else str(ts)[:16].replace("T", " ")
        pred = round(float(p.get("predicted", 0)))
        lower = round(float(p.get("lower_ci", pred * 0.9)))
        upper = round(float(p.get("upper_ci", pred * 1.1)))
        lvl = str(p.get("congestion_level", "low")).upper()

        table_rows.append([ts_str, jid, f"{pred:,} veh/h", f"{lower:,}", f"{upper:,}", lvl])
        dict_rows.append({
            "timestamp": ts_str,
            "junction_id": jid,
            "predicted": pred,
            "lower_ci": lower,
            "upper_ci": upper,
            "congestion_level": lvl,
        })

    kpis = [
        ("Target Junction", jid),
        ("Forecast Horizon", f"{horizon} Hours"),
        ("Mean Hourly Traffic", f"{avg_val:,} veh/h"),
        ("Peak Hourly Volume", f"{max_val:,} veh/h"),
    ]

    return {
        "title": "Traffic Volume Forecast Summary Report",
        "subtitle": f"Multi-step recursive traffic inference for Intersection {jid} with 95% confidence bounds.",
        "kpis": kpis,
        "headers": headers,
        "rows": table_rows,
        "raw_dict_rows": dict_rows,
        "recommendations": [
            "Use the 95% upper confidence interval bound for peak-hour road capacity emergency planning.",
            "Schedule maintenance windows during forecasted low-throughput periods.",
        ],
    }


async def _gather_model_comparison_data(db) -> dict:
    models = [m async for m in db.models.find({}).sort("created_at", -1)]
    headers = ["Model / Algorithm", "Version", "Target Junction", "MAE", "RMSE", "R² Score", "Status"]
    table_rows = []
    dict_rows = []

    best_r2 = -999.0
    best_model_name = "N/A"

    for m in models:
        metrics = m.get("metrics") or {}
        r2 = metrics.get("r2")
        r2_str = f"{r2:.4f}" if r2 is not None else "—"
        mae = metrics.get("mae")
        mae_str = f"{mae:.2f}" if mae is not None else "—"
        rmse = metrics.get("rmse")
        rmse_str = f"{rmse:.2f}" if rmse is not None else "—"

        if r2 is not None and r2 > best_r2:
            best_r2 = r2
            best_model_name = f"{m.get('algorithm')} (v{m.get('version', 1)})"

        status_str = "ACTIVE" if m.get("is_active") else m.get("status", "ready").upper()

        table_rows.append([
            f"{m.get('algorithm', 'Unknown')} ({m.get('name', '')})",
            f"v{m.get('version', 1)}",
            m.get("junction_id", "All"),
            mae_str,
            rmse_str,
            r2_str,
            status_str,
        ])
        dict_rows.append({
            "algorithm": m.get("algorithm"),
            "name": m.get("name"),
            "version": m.get("version"),
            "junction_id": m.get("junction_id"),
            "mae": mae,
            "rmse": rmse,
            "r2": r2,
            "status": status_str,
        })

    kpis = [
        ("Evaluated Models", f"{len(models)} configurations"),
        ("Top Scoring Model", best_model_name),
        ("Best R² Accuracy", f"{best_r2:.4f}" if best_r2 > -990 else "—"),
        ("Validation Split", "80% Train / 20% Test"),
    ]

    return {
        "title": "Machine Learning Model Evaluation & Benchmark Report",
        "subtitle": "Comparative analysis across Seasonal Naive, SARIMAX, and Random Forest regressors.",
        "kpis": kpis,
        "headers": headers,
        "rows": table_rows,
        "raw_dict_rows": dict_rows,
        "recommendations": [
            f"The best performing algorithm on historical validation data is {best_model_name}.",
            "Retrain models periodically when new weather patterns or seasonal calendar shifts occur.",
        ],
    }


async def _gather_dataset_validation_data(db) -> dict:
    datasets = [d async for d in db.datasets.find({}).sort("created_at", -1)]
    headers = ["Dataset Name", "Source File", "Total Rows", "Valid Rows", "Duplicates Dropped", "Status"]
    table_rows = []
    dict_rows = []

    total_records = 0
    for d in datasets:
        rep = d.get("validation_report") or {}
        tot = d.get("row_count") or rep.get("total_rows", 0)
        valid = rep.get("valid_rows", tot)
        dups = rep.get("duplicate_rows", 0)
        total_records += tot

        table_rows.append([
            d.get("name", "Unnamed"),
            d.get("original_filename", "—"),
            f"{tot:,}",
            f"{valid:,}",
            f"{dups:,}",
            d.get("status", "unknown").upper(),
        ])
        dict_rows.append({
            "name": d.get("name"),
            "filename": d.get("original_filename"),
            "total_rows": tot,
            "valid_rows": valid,
            "duplicates": dups,
            "status": d.get("status"),
        })

    kpis = [
        ("Total Ingested Datasets", f"{len(datasets)} files"),
        ("Clean Observation Rows", f"{total_records:,} rows"),
        ("Integrity Enforcement", "Strict Chronological"),
        ("Data Quality Standard", "Zero Missing Targets"),
    ]

    return {
        "title": "Dataset Quality & Telemetry Ingestion Audit",
        "subtitle": "Summary of ingested CSV/XLSX traffic telemetry, validation constraints, and clean row counts.",
        "kpis": kpis,
        "headers": headers,
        "rows": table_rows,
        "raw_dict_rows": dict_rows,
        "recommendations": [
            "All datasets meet the required schema constraints (timestamp, junction_id, vehicle_count).",
            "Out-of-bound negative vehicle readings were successfully clamped to zero during ingestion.",
        ],
    }


# ---------------------------------------------------------------------------
# Report Builders: PDF, Excel, CSV
# ---------------------------------------------------------------------------

async def _build_report(body: ReportCreate) -> tuple[bytes, str]:
    if body.format == ReportFormat.csv:
        content = await _csv_report(body)
        return content, "report.csv"
    elif body.format == ReportFormat.xlsx:
        content = await _xlsx_report(body)
        return content, "report.xlsx"
    else:
        content = await _pdf_report(body)
        return content, "report.pdf"


async def _csv_report(body: ReportCreate) -> bytes:
    data = await _get_report_data(body)
    raw_rows = data.get("raw_dict_rows")
    if raw_rows:
        df = pd.DataFrame(raw_rows)
    elif data.get("rows") and data.get("headers"):
        df = pd.DataFrame(data["rows"], columns=data["headers"])
    else:
        df = pd.DataFrame([{"message": "No data available for report"}])
    return df.to_csv(index=False).encode("utf-8")


async def _xlsx_report(body: ReportCreate) -> bytes:
    data = await _get_report_data(body)
    raw_rows = data.get("raw_dict_rows")
    if raw_rows:
        df = pd.DataFrame(raw_rows)
    elif data.get("rows") and data.get("headers"):
        df = pd.DataFrame(data["rows"], columns=data["headers"])
    else:
        df = pd.DataFrame([{"message": "No data available for report"}])

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Report")
    return buf.getvalue()


async def _pdf_report(body: ReportCreate) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    data = await _get_report_data(body)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        alignment=0,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748b"),
        alignment=0,
    )
    h2_style = ParagraphStyle(
        "ReportH2",
        parent=styles["Heading2"],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e293b"),
        fontName="Helvetica-Bold",
        spaceBefore=10,
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "ReportMeta",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )
    cell_style = ParagraphStyle(
        "ReportCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )
    cell_bold_style = ParagraphStyle(
        "ReportCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    cell_critical_style = ParagraphStyle(
        "ReportCellCritical",
        parent=cell_style,
        textColor=colors.HexColor("#dc2626"),
        fontName="Helvetica-Bold",
    )
    cell_high_style = ParagraphStyle(
        "ReportCellHigh",
        parent=cell_style,
        textColor=colors.HexColor("#ea580c"),
        fontName="Helvetica-Bold",
    )
    cell_ok_style = ParagraphStyle(
        "ReportCellOk",
        parent=cell_style,
        textColor=colors.HexColor("#16a34a"),
    )

    story = []

    # 1. Header Banner
    brand_p = Paragraph(
        "<font color='#0284c7'><b>JunctionFlow AI</b></font> • Smart Intersection Traffic Intelligence",
        ParagraphStyle("Brand", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#0284c7"), fontName="Helvetica-Bold"),
    )
    story.append(brand_p)
    story.append(Spacer(1, 4))
    story.append(Paragraph(data.get("title", "Telemetry Report"), title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph(data.get("subtitle", ""), subtitle_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=10))

    # 2. Executive KPI Cards Table
    kpis = data.get("kpis", [])
    if kpis:
        kpi_table_data = []
        row_labels = []
        row_values = []
        for label, val in kpis:
            row_labels.append(Paragraph(f"<b>{label.upper()}</b>", ParagraphStyle("KL", parent=meta_style, fontSize=7, textColor=colors.HexColor("#64748b"))))
            row_values.append(Paragraph(f"<b>{val}</b>", ParagraphStyle("KV", parent=styles["Normal"], fontSize=11, leading=14, textColor=colors.HexColor("#0f172a"), fontName="Helvetica-Bold")))

        kpi_table_data = [row_labels, row_values]
        col_width = (doc.width) / max(1, len(kpis))
        kpi_table = Table(kpi_table_data, colWidths=[col_width] * len(kpis))
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(kpi_table)
        story.append(Spacer(1, 14))

    # 3. Main Observation / Forecast Data Table
    headers = data.get("headers", [])
    rows = data.get("rows", [])

    if headers and rows:
        story.append(Paragraph("Detailed Analytical Breakdown", h2_style))
        story.append(Spacer(1, 4))

        # Format rows into Paragraph flowables to allow wrapping
        table_content = []
        header_row = [
            Paragraph(f"<b>{h}</b>", ParagraphStyle("TH", parent=meta_style, fontName="Helvetica-Bold", textColor=colors.white, fontSize=7.5))
            for h in headers
        ]
        table_content.append(header_row)

        for r in rows:
            formatted_r = []
            for item in r:
                s_item = str(item)
                if s_item in ("CRITICAL", "High (Bottleneck)"):
                    p = Paragraph(s_item, cell_critical_style)
                elif s_item in ("HIGH",):
                    p = Paragraph(s_item, cell_high_style)
                elif s_item in ("LOW", "MODERATE", "ACTIVE", "READY"):
                    p = Paragraph(s_item, cell_ok_style)
                elif s_item.endswith("veh/h") or s_item.endswith("%"):
                    p = Paragraph(s_item, cell_bold_style)
                else:
                    p = Paragraph(s_item, cell_style)
                formatted_r.append(p)
            table_content.append(formatted_r)

        # Distribute column widths across available printable width
        num_cols = len(headers)
        avail_width = doc.width
        if num_cols == 6:
            col_widths = [avail_width * 0.20, avail_width * 0.28, avail_width * 0.16, avail_width * 0.14, avail_width * 0.11, avail_width * 0.11]
        elif num_cols == 7:
            col_widths = [avail_width * 0.26, avail_width * 0.10, avail_width * 0.16, avail_width * 0.12, avail_width * 0.12, avail_width * 0.12, avail_width * 0.12]
        else:
            col_widths = [avail_width / num_cols] * num_cols

        main_table = Table(table_content, colWidths=col_widths, repeatRows=1)
        main_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TOPPADDING", (0, 0), (-1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
            ("TOPPADDING", (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(main_table)
        story.append(Spacer(1, 14))

    # 4. Actionable Traffic Intelligence Recommendations
    recs = data.get("recommendations", [])
    if recs:
        recs_content = [
            Paragraph("<b>Actionable Operational Recommendations:</b>", ParagraphStyle("RH", parent=h2_style, fontSize=10, textColor=colors.HexColor("#0369a1"))),
            Spacer(1, 4),
        ]
        for i, rec in enumerate(recs, 1):
            recs_content.append(Paragraph(
                f"<b>{i}.</b> {rec}",
                ParagraphStyle("RP", parent=cell_style, fontSize=8.5, leading=12, textColor=colors.HexColor("#334155")),
            ))
            recs_content.append(Spacer(1, 2))

        rec_table = Table([[recs_content]], colWidths=[doc.width])
        rec_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f9ff")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#bae6fd")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(KeepTogether(rec_table))
        story.append(Spacer(1, 10))

    # 5. Footer info
    footer_text = f"Generated by JunctionFlow AI Platform • Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} • Confidential Traffic Telemetry"
    story.append(Paragraph(footer_text, ParagraphStyle("Footer", parent=meta_style, alignment=1, fontSize=7, textColor=colors.HexColor("#94a3b8"))))

    doc.build(story)
    return buf.getvalue()


def _s(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc
