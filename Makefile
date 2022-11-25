.PHONY: install test-keys build start test clean-test-keys stop

TEST_KEY := $(shell solana-keygen pubkey ./tests/test-key.json)

all: install build stop start test stop

install:
	yarn install

build:
	anchor build
	yarn idl:generate
	yarn lint

start:
	solana-test-validator --url https://api.devnet.solana.com \
		--clone metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s --clone PwDiXFxQsGra4sFFTT8r1QWRMd4vfumiWC1jfWNfdYT \
		--clone mgr99QFMYByTqGPWmNqunV7vBLmWWXdSrHUfV8Jf3JM --clone ojLGErfqghuAqpJXE1dguXF7kKfvketCEeah8ig6GU3 \
		--clone tmeEDp1RgoDtZFtx6qod3HkbQmv9LMe36uqKVvsLTDE --clone DwoZ1RMgLEgSAsHNC2fecJqhvWvwhEkb9u29hVs2hNvg \
		--clone crt4Ymiqtk3M5w6JuKDT7GuZfUDiPLnhwRVqymSSBBn --clone 94mjR7rAf12K6u8WrLzUaZZnxtX1ZNBo3SPeQKZwXLx9 \
		--clone pmvYY6Wgvpe3DEj3UX1FcRpMx43sMLYLJrFTVGcqpdn --clone 355AtuHH98Jy9XFg5kWodfmvSfrhcxYUKGoJe8qziFNY \
		--bpf-program nameXpT2PwZ2iA6DTNYTotTmiMYusBCYqwBLN2QgF4w ./target/deploy/namespaces.so \
		--reset --quiet & echo $$! > validator.PID
	sleep 10
	solana-keygen pubkey ./tests/test-key.json
	solana airdrop 1000 $(TEST_KEY) --url http://localhost:8899

test:
	anchor test --skip-local-validator --skip-build --skip-deploy --provider.cluster localnet

stop: validator.PID
	pkill solana-test-validator