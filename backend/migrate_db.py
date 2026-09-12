import sqlite3

DATABASE_FILE = "pawsignal.db"

connection = sqlite3.connect(DATABASE_FILE)

cursor = connection.cursor()

cursor.execute(
    "PRAGMA table_info(cases)"
)

columns = [
    row[1]
    for row in cursor.fetchall()
]

if "created_at" not in columns:

    cursor.execute(
        """
        ALTER TABLE cases
        ADD COLUMN created_at DATETIME
        """
    )

    print("created_at column added successfully.")

else:

    print("created_at already exists.")

connection.commit()
connection.close()

print("Database migration complete.")