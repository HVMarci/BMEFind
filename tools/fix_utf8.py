import os
import argparse

def fix_content(content):
    """Applies the translation map to the string."""
    replacements = {
        'Ăˇ': 'á', 'Ă©': 'é', 'Ă­': 'í', 'Ăł': 'ó', 'Ă¶': 'ö', 
        'Ăş': 'ú', 'ĂĽ': 'ü', 'Ă»': 'ű',
        'Ă\x81': 'Á', 'Ă\x8d': 'Í', 'Ă\x93': 'Ó', 
        'Ă\x96': 'Ö', 'Ă\x95': 'Ő', 'Ă\x9a': 'Ú', 'Ă\x9c': 'Ü', 'Ă\x9b': 'Ű',
        # The 'ő' character variants
        'Ăµ': 'ő',      # Latin-1 variant
        'Ĺ‘': 'ő',      # Sometimes appears as this specific sequence
        'Å‘': 'ő',      # Double UTF-8 encoding variant
        
        # The 'É' character variants
        'Ă\x89': 'É',   # Standard Mojibake
        'Ă‰': 'É',      # Windows-1252/ISO-8859-1 mixed variant
    }
    for broken, fixed in replacements.items():
        content = content.replace(broken, fixed)
    return content

def process_directory(root_path):
    # Walk through the directory recursively
    for root, dirs, files in os.walk(root_path):
        for file in files:
            # You can add extensions here to skip images/binaries (e.g., .txt, .js, .php)
            if file.endswith(('.txt', '.js', '.json', '.html', '.php', '.csv')):
                file_path = os.path.join(root, file)
                
                try:
                    # 1. Read the file
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        original_content = f.read()

                    # 2. Fix the content
                    fixed_content = fix_content(original_content)

                    # 3. Only overwrite if changes were actually made
                    if original_content != fixed_content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(fixed_content)
                        print(f"Fixed: {file_path}")
                    else:
                        print(f"Skipped (No broken chars): {file_path}")

                except Exception as e:
                    print(f"Could not process {file_path}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recursively fix Hungarian UTF-8 Mojibake.")
    parser.add_argument("directory", help="The root directory to process")
    
    args = parser.parse_args()
    
    if os.path.isdir(args.directory):
        print(f"Starting repair in: {args.directory}")
        process_directory(args.directory)
        print("Done!")
    else:
        print(f"Error: {args.directory} is not a valid directory.")
