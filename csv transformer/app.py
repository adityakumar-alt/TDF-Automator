import os
import pandas as pd
import uuid
import csv

from flask import (
    Flask,
    render_template,
    request,
    send_from_directory,
    flash,
    redirect
)

from werkzeug.utils import secure_filename


# ============================================================
# FLASK CONFIGURATION
# ============================================================

app = Flask(__name__)

app.secret_key = "secret_transformation_key"

# Maximum upload size = 100 MB
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024


# ============================================================
# FOLDER CONFIGURATION
# ============================================================

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'

# Maximum rows per output CSV
ROWS_PER_FILE = 14998


# Create folders if they don't exist
for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
    os.makedirs(folder, exist_ok=True)


# ============================================================
# ALLOWED FILE CHECK
# ============================================================

def allowed_file(filename):
    """
    Allow CSV and TXT files.
    """

    return (
        '.' in filename
        and filename.rsplit('.', 1)[1].lower()
        in ['csv', 'txt']
    )


# ============================================================
# READ CSV SAFELY
# ============================================================

def read_csv_safely(file_path):
    """
    Try multiple encodings to safely read CSV files.

    dtype=str is important because property codes such as
    0472129 must remain strings.
    """

    encodings = [
        'utf-8',
        'utf-8-sig',
        'cp1252',
        'latin-1',
        'iso-8859-1'
    ]

    for enc in encodings:

        try:

            return pd.read_csv(
                file_path,
                encoding=enc,
                dtype=str
            )

        except UnicodeDecodeError:
            continue

        except Exception:
            continue

    # Final fallback
    return pd.read_csv(
        file_path,
        encoding='utf-8',
        encoding_errors='ignore',
        dtype=str
    )


# ============================================================
# FIND COLUMN NAME
# ============================================================

def find_column_name(df_cols, possible_names):
    """
    Find a column regardless of:
    - uppercase/lowercase
    - leading/trailing spaces
    """

    df_cols_clean = {
        str(col).strip().lower(): col
        for col in df_cols
    }

    for name in possible_names:

        name_clean = name.strip().lower()

        if name_clean in df_cols_clean:
            return df_cols_clean[name_clean]

    return None


# ============================================================
# PROPERTY CODE CLEANING
# ============================================================

def clean_property_code(value):
    """
    Convert property code to exactly 7-digit format.

    Examples:
        0472129   -> 0472129
        472129    -> 0472129
        0002365   -> 0002365
        1541487   -> 1541487
        472129.0  -> 0472129
    """

    if pd.isna(value):
        return ""

    value = str(value).strip()

    if value == "" or value.lower() == "nan":
        return ""

    # Remove leading apostrophe and Excel-style ="0472129"
    value = value.lstrip("'")
    value = value.replace('="', '').replace('"', '').strip()

    # Handle values such as 472129.0
    try:
        number = float(value)

        if number.is_integer():
            return f"{int(number):07d}"

    except (ValueError, TypeError):
        pass

    # Keep only digits
    digits_only = ''.join(
        char for char in value
        if char.isdigit()
    )

    if digits_only == "":
        return ""

    # Always return exactly 7 digits
    return digits_only.zfill(7)


# ============================================================
# SKU CODE CLEANING
# ============================================================

def clean_sku_code(value):
    """
    Clean SKU code.

    Examples:
        23      -> 23
        23.0    -> 23
        83      -> 83
    """

    if pd.isna(value):
        return ""

    value = str(value).strip()

    if value == "" or value.lower() == "nan":
        return ""

    if value.endswith('.0'):
        value = value[:-2]

    return value


# ============================================================
# PRICE CLEANING
# ============================================================

def clean_price(value):
    """
    Clean price values.

    Examples:
        1,462       -> 1462
        23,600      -> 23600
        1462.0      -> 1462
    """

    if pd.isna(value):
        return ""

    value = str(value).strip()

    if value == "" or value.lower() == "nan":
        return ""

    # Remove commas
    value = value.replace(',', '')

    # Remove .0
    if value.endswith('.0'):
        value = value[:-2]

    return value


# ============================================================
# DATE CLEANING
# ============================================================

def clean_date(value):
    """
    Convert date into YYYY-MM-DD format.

    Examples:

        September 15, 2026 -> 2026-09-15
        15/09/2026         -> 2026-09-15
        2026-09-15         -> 2026-09-15
    """

    if pd.isna(value):
        return ""

    value = str(value).strip()

    if value == "" or value.lower() == "nan":
        return ""

    try:

        parsed_date = pd.to_datetime(
            value,
            format='mixed',
            errors='coerce'
        )

        if pd.notna(parsed_date):
            return parsed_date.strftime('%Y-%m-%d')

    except Exception:
        pass

    return value


# ============================================================
# MAIN PROCESSING FUNCTION
# ============================================================

def process_and_split(input_path):

    # --------------------------------------------------------
    # 1. READ INPUT CSV
    # --------------------------------------------------------

    df = read_csv_safely(input_path)

    if df is None or df.empty:

        raise ValueError(
            "The uploaded CSV file is empty or could not be read."
        )

    cols = df.columns


    # --------------------------------------------------------
    # 2. FIND PROPERTY CODE COLUMN
    # --------------------------------------------------------

    prop_col = find_column_name(
        cols,
        [
            'property_code',
            'propertycode',
            'cs_id',
            'hotel_id',
            'hotel id',
            'hotel_ids',
            'hotelid',
            'id'
        ]
    )

    if prop_col:

        df['property_code_clean'] = (
            df[prop_col]
            .apply(clean_property_code)
        )

    else:

        # Fallback to first column
        df['property_code_clean'] = (
            df.iloc[:, 0]
            .apply(clean_property_code)
        )


    # --------------------------------------------------------
    # 3. FIND SKU CODE COLUMN
    # --------------------------------------------------------

    sku_col = find_column_name(
        cols,
        [
            'sku_code',
            'sku',
            'skucode',
            'base room',
            'room_type'
        ]
    )

    if sku_col:

        df['sku_code_clean'] = (
            df[sku_col]
            .apply(clean_sku_code)
        )

    else:

        df['sku_code_clean'] = ""


    # --------------------------------------------------------
    # 4. FIND DATE COLUMN
    # --------------------------------------------------------

    date_col = find_column_name(
        cols,
        [
            'date',
            'target_date',
            'start_date',
            'start_range',
            'end_date',
            'end_range'
        ]
    )

    if date_col:

        df['date_clean'] = (
            df[date_col]
            .apply(clean_date)
        )

    else:

        df['date_clean'] = ""


    # --------------------------------------------------------
    # 5. FIND MIN PRICE COLUMN
    # --------------------------------------------------------

    min_col = find_column_name(
        cols,
        [
            'min_price',
            'minprice',
            'start_price',
            'floor',
            'price'
        ]
    )

    if min_col:

        df['min_price_clean'] = (
            df[min_col]
            .apply(clean_price)
        )

    else:

        df['min_price_clean'] = ""


    # --------------------------------------------------------
    # 6. FIND MAX PRICE COLUMN
    # --------------------------------------------------------

    max_col = find_column_name(
        cols,
        [
            'max_price',
            'maxprice',
            'end_price',
            'ceiling'
        ]
    )

    if max_col:

        df['max_price_clean'] = (
            df[max_col]
            .apply(clean_price)
        )

    else:

        df['max_price_clean'] = ""


    # --------------------------------------------------------
    # 7. FIND CHANNEL CODE
    # --------------------------------------------------------

    chan_col = find_column_name(
        cols,
        [
            'channel_code',
            'channel'
        ]
    )

    if chan_col:

        channel_values = (
            df[chan_col]
            .fillna('')
            .astype(str)
            .str.strip()
        )

    else:

        # Always create the column
        channel_values = pd.Series(
            '',
            index=df.index,
            dtype=str
        )


    # --------------------------------------------------------
    # 8. FIND SUB CHANNEL CODE
    # --------------------------------------------------------

    sub_chan_col = find_column_name(
        cols,
        [
            'sub_channel_code',
            'sub_channel'
        ]
    )

    if sub_chan_col:

        sub_channel_values = (
            df[sub_chan_col]
            .fillna('')
            .astype(str)
            .str.strip()
        )

    else:

        # Always create the column
        sub_channel_values = pd.Series(
            '',
            index=df.index,
            dtype=str
        )


    # --------------------------------------------------------
    # 9. CREATE FINAL OUTPUT DATAFRAME
    # --------------------------------------------------------

    df_final = pd.DataFrame({

        'property_code':
            df['property_code_clean'],

        'sku_code':
            df['sku_code_clean'],

        'date':
            df['date_clean'],

        'min_price':
            df['min_price_clean'],

        'max_price':
            df['max_price_clean'],

        'channel_code':
            channel_values,

        'sub_channel_code':
            sub_channel_values

    }).fillna('')

    # --------------------------------------------------------
    # CONVERT PROPERTY CODE TO CLEAN NUMERIC STRING
    # --------------------------------------------------------

    df_final['property_code'] = df_final['property_code'].astype(str).str.strip()


    # --------------------------------------------------------
    # 10. FORCE COLUMN ORDER
    # --------------------------------------------------------

    df_final = df_final[
        [
            'property_code',
            'sku_code',
            'date',
            'min_price',
            'max_price',
            'channel_code',
            'sub_channel_code'
        ]
    ]


    # --------------------------------------------------------
    # 11. CREATE SESSION FOLDER
    # --------------------------------------------------------

    session_id = str(uuid.uuid4())

    session_path = os.path.join(
        OUTPUT_FOLDER,
        session_id
    )

    os.makedirs(
        session_path,
        exist_ok=True
    )


    # --------------------------------------------------------
    # 12. SPLIT INTO MULTIPLE CSV FILES
    # --------------------------------------------------------

    file_names = []

    total_rows = len(df_final)

    num_chunks = (
        total_rows // ROWS_PER_FILE
        + (
            1
            if total_rows % ROWS_PER_FILE > 0
            else 0
        )
    )


    for i in range(num_chunks):

        start_row = i * ROWS_PER_FILE

        end_row = (
            i + 1
        ) * ROWS_PER_FILE

        chunk = df_final.iloc[
            start_row:end_row
        ]


        file_name = f"Part_{i + 1}.csv"

        output_path = os.path.join(
            session_path,
            file_name
        )


        # Write CSV
        chunk.to_csv(
            output_path,
            index=False,
            encoding='utf-8-sig'
        )


        file_names.append(
            file_name
        )


    # --------------------------------------------------------
    # 13. PROPERTY CODE VALIDATION
    # --------------------------------------------------------

    valid_mask = (
    df_final['property_code']
    .astype(str)
    .str.match(r'^\d{7}$')
)

    valid_count = int(
        valid_mask.sum()
    )

    invalid_count = int(
        total_rows - valid_count
    )


    # --------------------------------------------------------
    # 14. PREVIEW
    # --------------------------------------------------------

    preview_rows = (
        df_final
        .head(10)
        .to_dict(
            orient='records'
        )
    )

    preview_cols = list(
        df_final.columns
    )


    # --------------------------------------------------------
    # 15. RETURN RESULTS
    # --------------------------------------------------------

    return (
        session_id,
        file_names,
        preview_rows,
        preview_cols,
        total_rows,
        valid_count,
        invalid_count
    )


# ============================================================
# HOME / UPLOAD ROUTE
# ============================================================

@app.route(
    '/',
    methods=['GET', 'POST']
)
def index():

    if request.method == 'POST':

        # Check file exists
        if 'file' not in request.files:

            flash(
                'No file part found in upload request.'
            )

            return redirect(
                request.url
            )


        file = request.files['file']


        # Validate file
        if (
            file.filename == ''
            or not allowed_file(file.filename)
        ):

            flash(
                'Please upload a valid CSV file (.csv)'
            )

            return redirect(
                request.url
            )


        try:

            # Secure uploaded filename
            filename = secure_filename(
                file.filename
            )


            input_path = os.path.join(
                UPLOAD_FOLDER,
                filename
            )


            # Save uploaded file
            file.save(
                input_path
            )


            # Process CSV
            (
                session_id,
                files,
                preview_rows,
                preview_cols,
                total_rows,
                valid_count,
                invalid_count
            ) = process_and_split(
                input_path
            )


            # Validation warning
            if invalid_count > 0:

                flash(
                    f"Validation Warning: "
                    f"{invalid_count} row(s) contain "
                    f"property codes that are not "
                    f"exactly 7 digits."
                )


            # Show download page
            return render_template(
                'download.html',

                session_id=session_id,

                files=files,

                preview_rows=preview_rows,

                preview_cols=preview_cols,

                total_rows=total_rows,

                valid_count=valid_count,

                invalid_count=invalid_count
            )


        except Exception as e:

            flash(
                f"Error processing CSV: {str(e)}"
            )

            return redirect(
                request.url
            )


    return render_template(
        'index.html'
    )


# ============================================================
# DOWNLOAD ROUTE
# ============================================================

@app.route(
    '/download/<session_id>/<filename>'
)
def download_file(
    session_id,
    filename
):

    return send_from_directory(

        os.path.join(
            OUTPUT_FOLDER,
            session_id
        ),

        filename
    )


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == '__main__':

    app.run(
        debug=True
    )