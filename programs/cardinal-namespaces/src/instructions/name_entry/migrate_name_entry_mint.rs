use {
    crate::{errors::ErrorCode, state::*},
    anchor_lang::prelude::*,
};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MigrateNameEntryMintIx {
    pub mint: Pubkey,
}

#[derive(Accounts)]
#[instruction(ix: MigrateNameEntryMintIx)]
pub struct MigrateNameEntryMintCtx<'info> {
    namespace: Box<Account<'info, Namespace>>,
    #[account(mut)]
    name_entry: Account<'info, Entry>,
    #[account(mut, constraint = update_authority.key() == namespace.update_authority @ ErrorCode::InvalidUpdateAuthority)]
    update_authority: Signer<'info>,
}

pub fn handler(ctx: Context<MigrateNameEntryMintCtx>, ix: MigrateNameEntryMintIx) -> Result<()> {
    let name_entry = &mut ctx.accounts.name_entry;
    name_entry.mint = ix.mint;
    name_entry.data = None;
    name_entry.is_claimed = false;

    let namespace = &mut ctx.accounts.namespace;
    namespace.count = namespace.count.checked_sub(1).expect("Sub error");

    Ok(())
}
