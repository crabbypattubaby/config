vim.g.mapleader = " "

-- Install Lazy.nvim (if not installed)
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
    vim.fn.system({
        "git", "clone",
        "--filter=blob:none",
        "https://github.com/folke/lazy.nvim.git",
        "--branch=stable", lazypath
    })
end
vim.opt.rtp:prepend(lazypath)

-- Plugin Setup
require("lazy").setup({
    -- Themes
    { "tiagovla/tokyodark.nvim", lazy = false, priority = 1000 },
    { "morhetz/gruvbox", lazy = false, priority = 1000 },

    { "L3MON4D3/LuaSnip", dependencies = { "rafamadriz/friendly-snippets" } },

    { "nvim-tree/nvim-tree.lua" },

    -- Status Line
    { "nvim-lualine/lualine.nvim", dependencies = { "kyazdani42/nvim-web-devicons" } },

    -- File Explorer
    { "nvim-tree/nvim-tree.lua" },

    -- LSP & Completion
    { "neovim/nvim-lspconfig" },  -- LSP configurations
    { "hrsh7th/nvim-cmp" },        -- Completion engine
    { "hrsh7th/cmp-nvim-lsp" },    -- LSP source for nvim-cmp
    { "williamboman/mason.nvim" }, -- LSP/DAP installer
    { "williamboman/mason-lspconfig.nvim" },

    -- Syntax Highlighting
    { "nvim-treesitter/nvim-treesitter", build = ":TSUpdate" },

    -- Telescope (Fuzzy Finder)
    { "nvim-telescope/telescope.nvim", dependencies = { "nvim-lua/plenary.nvim" } },

    -- Dashboard
    { "glepnir/dashboard-nvim" },
})

-- Set color scheme
vim.cmd("colorscheme gruvbox")

-- Fix tsserver deprecation issue
local lspconfig = require("lspconfig")
lspconfig.ts_ls.setup({}) -- Updated from tsserver to ts_ls
lspconfig.lua_ls.setup({})


-- Treesitter Configuration
require("nvim-treesitter.configs").setup({
    ensure_installed = "all",
    highlight = { enable = true },
})

-- 🛠 Fix Dashboard Colors (removes red bars)
vim.cmd([[
highlight DashboardHeader guifg=#ffcc00 guibg=NONE
highlight DashboardCenter guifg=#00ffcc guibg=NONE
highlight DashboardFooter guifg=#ffffff guibg=NONE
highlight DashboardShortcut guifg=#ff9900 guibg=NONE
]])

-- 📌 Custom Dashboard Header (Titlebar)
vim.g.dashboard_custom_header = {
    "", -- Empty lines for spacing
    "",
     "",
	"",
    "     ⠀⠀⠀⠀⠀⣀⣀⣀⣤⣤⣤⣤⣀⡀⠀⠀⠀⠀⠀  ",
    "     ⠀⠀⣠⡾⠛⠉⠀⠀⠀⠀⠀⠉⠙⠻⣦⡀⠀⠀  ",
    "     ⠀⣴⠏⠀⠀⢀⣀⣀⣀⣀⡀⠀⠀⠀⠙⣦⠀  ",
    "     ⢠⡏⠀⠰⡏⠁⠉⠉⠉⠉⠙⢦⠀⠀⠀⢹⡄  ",
    "     ⢸⡇⠀⠀⠹⡆⠀⠀⠀⠀⢀⡞⠀⠀⠀⢸⡇  ",
    "     ⠘⣧⠀⠀⠀⠙⠦⣀⠀⣀⠞⠁⠀⠀⢀⣾⠃  ",
    "      ⠹⣧⡀⠀⠀⠀⠉⠉⠉⠀⠀⠀⣀⣼⠏⠀  ",
    "      ⠀⠙⢿⣦⣀⠀⠀⠀⠀⠀⣀⣴⡿⠋⠀⠀  ",
    "      ⠀⠀⠀⠉⠛⠿⠷⠶⠾⠿⠛⠉⠀⠀⠀  ",
    "",
    "",
}

vim.g.dashboard_custom_footer = { "", "", "Welcome, Hacker!", "" } -- Extra spacing in footer
vim.g.dashboard_center_content = true -- Centering elements


vim.api.nvim_set_keymap("n", "<leader>r", ":Telescope oldfiles<CR>", { noremap = true, silent = true })



require("dashboard").setup({
    theme = "doom",  -- Ensure correct theme
    config = {
        header = vim.g.dashboard_custom_header, -- Use your custom header
        center = {
            { icon = "🔍", desc = " Find File", key = "f", action = "Telescope find_files" },
            { icon = "📂", desc = " Recent Files", key = "r", action = "Telescope oldfiles" },
            { icon = "📜", desc = " File Explorer", key = "e", action = "NvimTreeToggle" },
            { icon = "🆕", desc = " New File", key = "n", action = "ene | startinsert" },
            { icon = "❌", desc = " Quit", key = "q", action = "qa" },
        },
        footer = { "Tread if you dare!! ☠️ "}
    }
})


-- File Explorer Keybind
vim.api.nvim_set_keymap("n", "<leader>e", ":NvimTreeToggle<CR>", { noremap = true, silent = true })

-- Telescope Keybinds
vim.api.nvim_set_keymap("n", "<leader>f", ":Telescope find_files<CR>", { noremap = true, silent = true })
vim.api.nvim_set_keymap("n", "<leader>w", ":Telescope live_grep<CR>", { noremap = true, silent = true })

-- Ensure required dependencies are installed
vim.cmd([[if !executable('rg')
    echo "⚠️  Ripgrep (rg) is required for Telescope! Install it using: brew install ripgrep"
endif

if !executable('lua-language-server')
    echo "⚠️  Lua Language Server is missing! Install it using: brew install lua-language-server"
endif
]])

vim.api.nvim_set_keymap("n", "<F5>", ":w<CR>:term bash -c 'file=\"%\"; [[ $file == *.cpp ]] && compiler=clang++ || compiler=clang; [[ $file == *.cpp ]] && standard=-std=c++17 || standard=-std=c17; $compiler $standard \"$file\" -o \"%:r\" && ./\"%:r\"'<CR>i", { noremap = true, silent = true })


require'lspconfig'.clangd.setup{
  cmd = { "/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clangd" }
}

require("nvim-tree").setup({
    renderer = {
        icons = {
            show = {
                file = true,
                folder = true,
                folder_arrow = true,
                git = true,
            },
            glyphs = {
                default = "",  -- Default file icon
                symlink = "",
                folder = {
                    default = "",
                    open = "",
                    empty = "",
                    empty_open = "",
                    symlink = "",
                },
                git = {
                    unstaged = "",
                    staged = "",
                    unmerged = "",
                    renamed = "➜",
                    deleted = "",
                    untracked = "",
                    ignored = "◌",
                },
            },
        },
    },
    update_focused_file = {
        enable = true,
        update_cwd = true,
    },
    view = {
        width = 30,
        side = "left",
        signcolumn = "yes",
    },
    git = {
        enable = true,
        ignore = false,
        timeout = 500,
    },
    diagnostics = {
        enable = true,
        show_on_dirs = true,
        icons = {
            hint = "",
            info = "",
            warning = "",
            error = "",
        },
    },
})

require("nvim-web-devicons").setup()

-- Autocompletion Setup
local cmp = require("cmp")
local luasnip = require("luasnip")

cmp.setup({
    snippet = {
        expand = function(args)
            luasnip.lsp_expand(args.body)
        end,
    },
    mapping = cmp.mapping.preset.insert({
        ["<C-d>"] = cmp.mapping.scroll_docs(-4),
        ["<C-f>"] = cmp.mapping.scroll_docs(4),
        ["<C-Space>"] = cmp.mapping.complete(),
        ["<C-e>"] = cmp.mapping.abort(),
        ["<CR>"] = cmp.mapping.confirm({ select = true }),
    }),
    sources = cmp.config.sources({
        { name = "nvim_lsp" },
        { name = "luasnip" },
        { name = "buffer" },
        { name = "path" },
    }),
})

-- Enable autocompletion for command-line
cmp.setup.cmdline("/", {
    mapping = cmp.mapping.preset.cmdline(),
    sources = {
        { name = "buffer" }
    }
})

cmp.setup.cmdline(":", {
    mapping = cmp.mapping.preset.cmdline(),
    sources = cmp.config.sources({
        { name = "path" }
    }, {
        { name = "cmdline" }
    })
}
