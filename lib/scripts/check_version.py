import tomllib
import urllib.request
import json
import sys


def check_pypi_version() -> None:
    try:
        with open("pyproject.toml", "rb") as f:
            data = tomllib.load(f)
        version = data["project"]["version"]
        name = data["project"]["name"]

        print(f"Checking if {name} version {version} is already on PyPI...")

        url = f"https://pypi.org/pypi/{name}/json"
        try:
            with urllib.request.urlopen(url) as response:
                data = json.loads(response.read().decode())
                if version in data["releases"]:
                    print(
                        f"\033[91mError: Version {version} of {name} is already published to PyPI.\033[0m"
                    )
                    print(
                        "Please increment the version in pyproject.toml before pushing."
                    )
                    sys.exit(1)
                else:
                    print(f"Version {version} is available for publication.")
        except urllib.request.HTTPError as e:
            if e.code == 404:
                print(
                    f"Package {name} not found on PyPI. Version {version} will be the first release."
                )
                return
            print(f"Warning: Could not check PyPI (HTTP {e.code}). Skipping check.")
    except Exception as e:
        print(f"Warning: Error during version check: {e}. Skipping check.")


if __name__ == "__main__":
    check_pypi_version()
