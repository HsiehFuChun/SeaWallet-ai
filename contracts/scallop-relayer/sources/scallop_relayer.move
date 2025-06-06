/// Module: scallop_relayer
// how relayer works
// 1. The relayer has a imoprted account that bypass the TxContext requirement, 
module scallop_relayer::scallop_relayer;


// Standard SUI modules
use sui::sui::SUI;
use protocol::mint::mint;
use std::type_name::{Self, TypeName};
use sui::coin::{Self, Coin};
use sui::tx_context::{Self ,TxContext};
use sui::clock::{Self, Clock};
use sui::event::emit;
use sui::balance;
use protocol::market::{Self, Market};
use protocol::version::{Self, Version};
use protocol::reserve::MarketCoin;
use sui::transfer;
use whitelist::whitelist;
use protocol::error;

public struct SeaVault has store, key {
    id: UID,
}

// use mint to mint sSUI
    public fun mint_sSUI(
    version: &Version,
    market: &mut Market,
    coin: Coin<SUI>,
    clock: &Clock,
    seaVault: &mut SeaVault,
    ctx: &mut TxContext,
) {
    let sSui = mint(version, market, coin, clock, ctx);
    transfer::public_transfer(sSui, ctx.sender());
}


#[test_only]
use sui::test_scenario::{Self as ts, Scenario};
#[test_only]
const ALICE: address = @0xA;
#[test_only]
fun test_coin(ts: &mut Scenario): Coin<SUI> {
    coin::mint_for_testing(42, ts.ctx())
}

#[test]
fun test() {
    let mut ts = ts::begin(@0x0);
    {
        let seaVault = SeaVault {
            id: object::new(ts.ctx())
        };
        let version = version::create_for_testing(ts.ctx());
        let coin = test_coin(&mut ts);
        
        mint_sSUI(SCALLOP_VERSION_OBJECT, market, coin, , &mut seaVault, ctx);
    }
    ts::end(ts);
}



